import type { ChatMessage } from '@vigas/core';

/** Request sent to one upstream provider, already resolved to its model name. */
export interface UpstreamRequest {
  upstreamModel: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** Passed through to OpenAI-compatible providers (temperature, top_p, stop, tools, …). */
  params: Record<string, unknown>;
}

export interface UpstreamUsage {
  promptTokens: number;
  completionTokens: number;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;

export interface UpstreamResult {
  content: string | null;
  toolCalls?: unknown[];
  finishReason: FinishReason;
  usage: UpstreamUsage | null;
}

export type StreamEvent =
  | { type: 'delta'; content?: string; toolCalls?: unknown[] }
  | { type: 'finish'; finishReason: FinishReason }
  | { type: 'usage'; usage: UpstreamUsage };

export interface ProviderAdapter {
  readonly slug: string;
  complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult>;
  stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

/**
 * An upstream failure. `retryable` failures (rate limits, 5xx, timeouts, network) move the request
 * to the next provider; the others are returned to the caller.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly code: string = 'upstream_error',
  ) {
    super(message);
  }

  static fromStatus(status: number, message: string): ProviderError {
    const retryable = status === 408 || status === 409 || status === 429 || status >= 500;
    const code = status === 429 ? 'rate_limited' : status >= 500 ? 'upstream_unavailable' : 'upstream_rejected';
    return new ProviderError(message, status, retryable, code);
  }
}

export function asProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof Error && err.name === 'AbortError') return new ProviderError('Upstream timed out', 504, true, 'timeout');
  return new ProviderError(err instanceof Error ? err.message : 'Upstream request failed', 502, true, 'network_error');
}
