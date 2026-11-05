import { messageText, type ChatMessage } from '@vigas/core';
import { sseData } from './sse';
import {
  ProviderError,
  type FinishReason,
  type ProviderAdapter,
  type StreamEvent,
  type UpstreamRequest,
  type UpstreamResult,
} from './types';

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContent[];
}

const STOP: Record<string, FinishReason> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  tool_use: 'tool_calls',
  refusal: 'content_filter',
};

/** Converts OpenAI-style messages to the Anthropic Messages API (text and images). */
export function toAnthropic(messages: ChatMessage[]): { system?: string; messages: AnthropicMessage[] } {
  const system: string[] = [];
  const out: AnthropicMessage[] = [];
  const push = (role: 'user' | 'assistant', content: AnthropicContent[]) => {
    if (content.length === 0) return;
    const last = out.at(-1);
    if (last && last.role === role) last.content.push(...content);
    else out.push({ role, content });
  };
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'developer') {
      system.push(messageText(m.content));
    } else if (m.role === 'user') {
      if (typeof m.content === 'string') {
        push('user', [{ type: 'text', text: m.content }]);
      } else {
        push(
          'user',
          m.content.map<AnthropicContent>((p) => {
            if (p.type === 'text') return { type: 'text', text: p.text };
            const match = /^data:([^;]+);base64,(.*)$/.exec(p.image_url.url);
            return match
              ? { type: 'image', source: { type: 'base64', media_type: match[1]!, data: match[2]! } }
              : { type: 'image', source: { type: 'url', url: p.image_url.url } };
          }),
        );
      }
    } else if (m.role === 'assistant') {
      const text = messageText(m.content);
      if (text) push('assistant', [{ type: 'text', text }]);
    } else if (m.role === 'tool') {
      push('user', [{ type: 'text', text: `Tool result (${m.tool_call_id}):\n${messageText(m.content)}` }]);
    }
  }
  return { system: system.length ? system.join('\n\n') : undefined, messages: out };
}

export class AnthropicAdapter implements ProviderAdapter {
  constructor(
    readonly slug: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async post(req: UpstreamRequest, stream: boolean, signal: AbortSignal): Promise<Response> {
    if (req.params.tools) {
      throw new ProviderError('Tool calling is not supported on this provider yet', 400, true, 'unsupported_parameter');
    }
    const { system, messages } = toAnthropic(req.messages);
    const p = req.params;
    const stop = typeof p.stop === 'string' ? [p.stop] : Array.isArray(p.stop) ? p.stop : undefined;
    const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: req.upstreamModel,
        max_tokens: req.maxTokens,
        system,
        messages,
        stream,
        ...(typeof p.temperature === 'number' ? { temperature: Math.min(1, p.temperature) } : {}),
        ...(typeof p.top_p === 'number' ? { top_p: p.top_p } : {}),
        ...(stop ? { stop_sequences: stop } : {}),
      }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text.slice(0, 500) || res.statusText;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        // keep raw text
      }
      // Anthropic uses 529 for "overloaded".
      throw ProviderError.fromStatus(res.status, `${this.slug}: ${message}`);
    }
    return res;
  }

  async complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult> {
    const res = await this.post(req, false, signal);
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      stop_reason: string | null;
      usage?: { input_tokens: number; output_tokens: number };
    };
    return {
      content: json.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''),
      finishReason: (json.stop_reason && STOP[json.stop_reason]) || 'stop',
      usage: json.usage ? { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens } : null,
    };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const res = await this.post(req, true, signal);
    if (!res.body) throw new ProviderError(`${this.slug}: empty stream`, 502, true);
    let promptTokens = 0;
    for await (const data of sseData(res.body)) {
      let ev: {
        type: string;
        message?: { usage?: { input_tokens?: number } };
        delta?: { type?: string; text?: string; stop_reason?: string | null };
        usage?: { output_tokens?: number; input_tokens?: number };
        error?: { message?: string; type?: string };
      };
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === 'message_start') promptTokens = ev.message?.usage?.input_tokens ?? 0;
      else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        yield { type: 'delta', content: ev.delta.text };
      } else if (ev.type === 'message_delta') {
        if (ev.delta?.stop_reason) yield { type: 'finish', finishReason: STOP[ev.delta.stop_reason] ?? 'stop' };
        if (ev.usage) {
          yield {
            type: 'usage',
            usage: { promptTokens: ev.usage.input_tokens ?? promptTokens, completionTokens: ev.usage.output_tokens ?? 0 },
          };
        }
      } else if (ev.type === 'error') {
        throw new ProviderError(`${this.slug}: ${ev.error?.message ?? 'stream error'}`, 502, true);
      }
    }
  }
}
