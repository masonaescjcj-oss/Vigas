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
  | { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContent[];
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: unknown;
}

/** OpenAI-style tool call as returned in `message.tool_calls`. */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const STOP: Record<string, FinishReason> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  tool_use: 'tool_calls',
  refusal: 'content_filter',
};

function parseArguments(args: string): unknown {
  try {
    return args ? JSON.parse(args) : {};
  } catch {
    return {};
  }
}

/** Converts OpenAI-style messages to the Anthropic Messages API: text, images, tool calls and tool results. */
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
      const content: AnthropicContent[] = [];
      const text = messageText(m.content);
      if (text) content.push({ type: 'text', text });
      for (const call of m.tool_calls ?? []) {
        content.push({ type: 'tool_use', id: call.id, name: call.function.name, input: parseArguments(call.function.arguments) });
      }
      push('assistant', content);
    } else if (m.role === 'tool') {
      push('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: messageText(m.content) }]);
    }
  }
  return { system: system.length ? system.join('\n\n') : undefined, messages: out };
}

/** OpenAI `tools` → Anthropic `tools`. Only function tools are supported. */
export function toAnthropicTools(tools: unknown): AnthropicTool[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map((t) => {
    const fn = (t as { type?: string; function?: { name?: string; description?: string; parameters?: unknown } }).function;
    if ((t as { type?: string }).type !== 'function' || !fn?.name) {
      throw new ProviderError('Only "function" tools are supported', 400, false, 'unsupported_parameter');
    }
    return { name: fn.name, description: fn.description, input_schema: fn.parameters ?? { type: 'object', properties: {} } };
  });
}

/** OpenAI `tool_choice` → Anthropic `tool_choice`. */
export function toAnthropicToolChoice(choice: unknown): Record<string, unknown> | undefined {
  if (choice === undefined || choice === null) return undefined;
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'none') return { type: 'none' };
  if (choice === 'required') return { type: 'any' };
  const name = (choice as { function?: { name?: string } }).function?.name;
  return name ? { type: 'tool', name } : undefined;
}

export class AnthropicAdapter implements ProviderAdapter {
  constructor(
    readonly slug: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async post(req: UpstreamRequest, stream: boolean, signal: AbortSignal): Promise<Response> {
    const { system, messages } = toAnthropic(req.messages);
    const p = req.params;
    const tools = toAnthropicTools(p.tools);
    const toolChoice = tools ? toAnthropicToolChoice(p.tool_choice) : undefined;
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
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
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
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      stop_reason: string | null;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const toolCalls: OpenAIToolCall[] = json.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({ id: c.id ?? '', type: 'function', function: { name: c.name ?? '', arguments: JSON.stringify(c.input ?? {}) } }));
    const text = json.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
    return {
      content: text || (toolCalls.length ? null : ''),
      ...(toolCalls.length ? { toolCalls } : {}),
      finishReason: (json.stop_reason && STOP[json.stop_reason]) || 'stop',
      usage: json.usage ? { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens } : null,
    };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const res = await this.post(req, true, signal);
    if (!res.body) throw new ProviderError(`${this.slug}: empty stream`, 502, true);
    let promptTokens = 0;
    // Anthropic numbers content blocks; OpenAI numbers tool calls. Map block index → tool call index.
    const toolIndex = new Map<number, number>();
    for await (const data of sseData(res.body)) {
      let ev: {
        type: string;
        index?: number;
        message?: { usage?: { input_tokens?: number } };
        content_block?: { type?: string; id?: string; name?: string };
        delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string | null };
        usage?: { output_tokens?: number; input_tokens?: number };
        error?: { message?: string; type?: string };
      };
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === 'message_start') {
        promptTokens = ev.message?.usage?.input_tokens ?? 0;
      } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        const i = toolIndex.size;
        toolIndex.set(ev.index ?? i, i);
        yield {
          type: 'delta',
          toolCalls: [{ index: i, id: ev.content_block.id, type: 'function', function: { name: ev.content_block.name, arguments: '' } }],
        };
      } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        yield { type: 'delta', content: ev.delta.text };
      } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'input_json_delta' && ev.delta.partial_json) {
        const i = toolIndex.get(ev.index ?? -1) ?? 0;
        yield { type: 'delta', toolCalls: [{ index: i, function: { arguments: ev.delta.partial_json } }] };
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
