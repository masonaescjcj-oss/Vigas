import type { ChatCompletion, ChatCompletionChunk } from '@vigas/core';
import { sseData } from './sse';
import { ProviderError, type ProviderAdapter, type StreamEvent, type UpstreamRequest, type UpstreamResult } from './types';

interface OpenAIUsageExt {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

function sanitizeHost(raw: string, baseUrl: string): string {
  try {
    const host = new URL(baseUrl).host;
    return host ? raw.replaceAll(host, 'upstream') : raw;
  } catch {
    return raw;
  }
}

/** Any provider that speaks the OpenAI Chat Completions API (OpenAI, Google, DeepSeek, Moonshot, …). */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  private readonly label: string;

  constructor(
    readonly slug: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    errorLabel?: string,
  ) {
    this.label = errorLabel ?? slug;
  }

  private body(req: UpstreamRequest, stream: boolean) {
    return JSON.stringify({
      ...req.params,
      model: req.upstreamModel,
      messages: req.messages,
      max_tokens: req.maxTokens,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    });
  }

  private async post(req: UpstreamRequest, stream: boolean, signal: AbortSignal): Promise<Response> {
    if (!this.baseUrl) throw new ProviderError(`Provider "${this.label}" has no base URL configured`, 503, true, 'provider_not_configured');
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: this.body(req, stream),
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
      throw ProviderError.fromStatus(res.status, `${this.label}: ${sanitizeHost(message, this.baseUrl)}`);
    }
    return res;
  }

  async complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult> {
    const res = await this.post(req, false, signal);
    const json = (await res.json()) as ChatCompletion & { usage?: OpenAIUsageExt };
    const choice = json.choices?.[0];
    const cached = json.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      content: choice?.message?.content ?? null,
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason ?? 'stop',
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            ...(cached > 0 ? { cachedPromptTokens: cached } : {}),
          }
        : null,
    };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const res = await this.post(req, true, signal);
    if (!res.body) throw new ProviderError(`${this.label}: empty stream`, 502, true);
    for await (const data of sseData(res.body)) {
      if (data === '[DONE]') break;
      let chunk: ChatCompletionChunk & { usage?: OpenAIUsageExt };
      try {
        chunk = JSON.parse(data) as ChatCompletionChunk & { usage?: OpenAIUsageExt };
      } catch {
        continue;
      }
      const choice = chunk.choices?.[0];
      if (choice?.delta && (choice.delta.content || choice.delta.tool_calls)) {
        yield { type: 'delta', content: choice.delta.content ?? undefined, toolCalls: choice.delta.tool_calls };
      }
      if (choice?.finish_reason) yield { type: 'finish', finishReason: choice.finish_reason };
      if (chunk.usage) {
        const cached = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
        yield {
          type: 'usage',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            ...(cached > 0 ? { cachedPromptTokens: cached } : {}),
          },
        };
      }
    }
  }
}
