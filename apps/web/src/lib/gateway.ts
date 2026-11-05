import { NextResponse } from 'next/server';
import type { ChatCompletion, ChatMessage } from '@vigas/core';
import { serverEnv } from './env';
import { apiError } from './http';

export type GatewaySource = 'chat' | 'arena';

export class GatewayUnavailableError extends Error {}

/** An error response from the gateway, kept so it can be passed through with the same status. */
export class GatewayHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Gateway responded ${status}`);
  }
}

const HEADER_TIMEOUT_MS = 30_000;

/**
 * POSTs an OpenAI-compatible chat request to the Vigas gateway on behalf of an account. Throws
 * GatewayUnavailableError when the gateway cannot be reached. The response is returned as is.
 */
export async function postChatCompletion(
  body: Record<string, unknown>,
  opts: { accountId: string; source: GatewaySource; signal?: AbortSignal },
): Promise<Response> {
  const env = serverEnv();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('Gateway timed out')), HEADER_TIMEOUT_MS);
  const onAbort = () => ctrl.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(`${env.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: body.stream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${env.internalToken}`,
        'X-Vigas-Account': opts.accountId,
        'X-Vigas-Source': opts.source,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new GatewayUnavailableError(err instanceof Error ? err.message : 'Gateway unreachable');
  } finally {
    // Only the wait for response headers is bounded; a streaming body may run longer.
    clearTimeout(timer);
  }
}

/** Reads an upstream error body. OpenAI-format errors are kept verbatim. */
export async function readUpstreamError(res: Response): Promise<GatewayHttpError> {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text) as unknown;
    if (json && typeof json === 'object' && 'error' in json) return new GatewayHttpError(res.status, json);
  } catch {
    // Not JSON.
  }
  return new GatewayHttpError(res.status, {
    error: { code: 'gateway_error', message: `The model gateway returned HTTP ${res.status}.` },
  });
}

export function gatewayErrorResponse(err: unknown): NextResponse {
  if (err instanceof GatewayHttpError) {
    return NextResponse.json(err.body, { status: err.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
  return apiError(
    502,
    'gateway_unavailable',
    'The Vigas model gateway is not reachable right now. Please try again in a moment.',
  );
}

/** Non-streaming completion; returns the assistant text. */
export async function completeText(
  model: string,
  messages: ChatMessage[],
  opts: { accountId: string; source: GatewaySource; maxTokens?: number },
): Promise<string> {
  const res = await postChatCompletion(
    { model, messages, stream: false, ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}) },
    opts,
  );
  if (!res.ok) throw await readUpstreamError(res);
  let json: ChatCompletion;
  try {
    json = (await res.json()) as ChatCompletion;
  } catch {
    throw new GatewayHttpError(502, { error: { code: 'gateway_error', message: 'The model gateway sent an unreadable response.' } });
  }
  return json.choices?.[0]?.message?.content ?? '';
}
