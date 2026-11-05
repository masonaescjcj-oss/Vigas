import {
  chatCompletionRequestSchema,
  costMicros,
  endpointKey,
  estimateMaxCostMicros,
  estimateTokens,
  messageText,
  planRoute,
  RouteError,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatCompletionRequest,
  type RouteCandidate,
} from '@vigas/core';
import { randomBase62 } from '@vigas/core/server';
import { reserveCredits, settleUsage, type Db } from '@vigas/db';
import { authenticate, type Caller } from './auth';
import type { GatewayConfig } from './config';
import { errorResponse } from './errors';
import { asProviderError, type AdapterResolver, type ProviderAdapter, type ProviderError, type StreamEvent, type UpstreamUsage } from './providers';
import type { CatalogCache, EndpointHealth, RateLimiter } from './state';

export interface GatewayDeps {
  db: Db;
  config: GatewayConfig;
  adapters: AdapterResolver;
  catalog: CatalogCache;
  health: EndpointHealth;
  limiter: RateLimiter;
}

/** Request fields the gateway handles itself; everything else is passed to the provider. */
const GATEWAY_FIELDS = new Set(['model', 'models', 'messages', 'stream', 'stream_options', 'max_tokens', 'max_completion_tokens', 'route']);

const toUsd = (micros: number) => Number((micros / 1_000_000).toFixed(8));

interface Attempt {
  candidate: RouteCandidate;
  adapter: ProviderAdapter;
}

interface Context {
  deps: GatewayDeps;
  caller: Caller;
  body: ChatCompletionRequest;
  attempts: Attempt[];
  holdId: string;
  promptEstimate: number;
  maxTokens: number;
  params: Record<string, unknown>;
  id: string;
  created: number;
  clientSignal: AbortSignal;
}

export async function handleChatCompletion(deps: GatewayDeps, req: Request): Promise<Response> {
  const auth = await authenticate(deps.db, deps.config, req.headers);
  if (!auth.ok) return errorResponse(auth.status, auth.message, 'authentication_error', 'invalid_api_key');
  const caller = auth.caller;

  const wait = deps.limiter.take(caller.limitKey);
  if (wait > 0) {
    return errorResponse(429, `Rate limit exceeded. Retry in ${wait}s.`, 'rate_limit_error', 'rate_limited', { 'Retry-After': String(wait) });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, 'Request body must be valid JSON', 'invalid_request_error', 'invalid_json');
  }
  const parsed = chatCompletionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at "${issue.path.join('.')}"` : '';
    return errorResponse(400, `Invalid request${where}: ${issue?.message ?? 'bad input'}`, 'invalid_request_error', 'invalid_request');
  }
  const body = parsed.data;

  const snap = await deps.catalog.get();
  let plan: RouteCandidate[];
  try {
    plan = planRoute({
      model: body.model,
      models: body.models,
      catalog: snap.models,
      endpoints: snap.endpoints,
      ratings: snap.ratings,
      stats: deps.health.stats(),
      options: { sort: body.route?.sort, fallbacks: body.route?.fallbacks },
    });
  } catch (err) {
    if (err instanceof RouteError) {
      return err.code === 'model_not_found'
        ? errorResponse(404, err.message, 'not_found_error', err.code)
        : errorResponse(503, err.message, 'api_error', err.code);
    }
    throw err;
  }

  const attempts = plan
    .map((candidate) => ({ candidate, adapter: deps.adapters(candidate.endpoint.provider) }))
    .filter((a): a is Attempt => a.adapter !== null);
  if (attempts.length === 0) {
    return errorResponse(503, `No provider is configured for "${body.model}" yet`, 'api_error', 'no_available_endpoint');
  }

  const maxTokens = body.max_completion_tokens ?? body.max_tokens ?? deps.config.defaultMaxTokens;
  const promptEstimate = body.messages.reduce((n, m) => n + estimateTokens(messageText(m.content)) + 4, 0);
  const smallestContext = Math.min(...attempts.map((a) => a.candidate.model.contextLength));
  if (promptEstimate > smallestContext && attempts.length === 1) {
    return errorResponse(400, `Prompt is about ${promptEstimate} tokens; the model accepts ${smallestContext}.`, 'invalid_request_error', 'context_length_exceeded');
  }

  // Reserve enough for the most expensive endpoint that might serve the request.
  const reserve = Math.max(...attempts.map((a) => estimateMaxCostMicros(a.candidate.endpoint, promptEstimate, maxTokens)));
  const holdId = await reserveCredits(deps.db, caller.accountId, reserve);
  if (!holdId) {
    return errorResponse(402, 'Insufficient credits. Add credits at https://vigas.ai/dashboard', 'insufficient_quota', 'insufficient_credits');
  }

  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (!GATEWAY_FIELDS.has(k) && v !== undefined) params[k] = v;

  const ctx: Context = {
    deps,
    caller,
    body,
    attempts,
    holdId,
    promptEstimate,
    maxTokens,
    params,
    id: `gen-${randomBase62(24)}`,
    created: Math.floor(Date.now() / 1000),
    clientSignal: req.signal,
  };
  return body.stream ? streamCompletion(ctx) : completeOnce(ctx);
}

function settle(ctx: Context, a: Attempt, usage: UpstreamUsage | null, latencyMs: number, status: 'ok' | 'error', errorCode?: string) {
  const cost = usage ? costMicros(usage, a.candidate.endpoint) : 0;
  return settleUsage(ctx.deps.db, {
    holdId: ctx.holdId,
    accountId: ctx.caller.accountId,
    apiKeyId: ctx.caller.apiKeyId,
    source: ctx.caller.source,
    modelId: a.candidate.model.id,
    provider: a.candidate.endpoint.provider,
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    costMicros: cost,
    latencyMs,
    status,
    errorCode: errorCode ?? null,
  })
    .then(() => cost)
    .catch((err) => {
      console.error('[gateway] failed to settle usage', err);
      return cost;
    });
}

function linkedAbort(parent: AbortSignal, timeoutMs: number): { signal: AbortSignal; abort: () => void; clear: () => void } {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onParent = () => ac.abort();
  parent.addEventListener('abort', onParent, { once: true });
  return {
    signal: ac.signal,
    abort: () => ac.abort(),
    clear: () => {
      clearTimeout(timer);
      parent.removeEventListener('abort', onParent);
    },
  };
}

function failureResponse(err: ProviderError | null): Response {
  if (!err) return errorResponse(502, 'All providers failed', 'upstream_error', 'upstream_error');
  if (err.status === 429) return errorResponse(429, err.message, 'rate_limit_error', err.code);
  if (err.status >= 400 && err.status < 500 && err.status !== 408) return errorResponse(err.status, err.message, 'invalid_request_error', err.code);
  return errorResponse(502, err.message, 'upstream_error', err.code);
}

const routeHeaders = (a: Attempt) => ({ 'X-Vigas-Provider': a.candidate.endpoint.provider, 'X-Vigas-Model': a.candidate.model.id });

async function completeOnce(ctx: Context): Promise<Response> {
  const { deps } = ctx;
  let lastErr: ProviderError | null = null;
  let last: Attempt = ctx.attempts[0]!;
  for (const a of ctx.attempts) {
    last = a;
    const key = endpointKey(a.candidate.endpoint);
    const started = Date.now();
    const abort = linkedAbort(ctx.clientSignal, deps.config.requestTimeoutMs);
    try {
      const result = await a.adapter.complete(
        { upstreamModel: a.candidate.endpoint.upstreamModel, messages: ctx.body.messages, maxTokens: ctx.maxTokens, params: ctx.params },
        abort.signal,
      );
      const latency = Date.now() - started;
      deps.health.success(key, latency);
      const usage = result.usage ?? { promptTokens: ctx.promptEstimate, completionTokens: estimateTokens(result.content ?? '') };
      const cost = await settle(ctx, a, usage, latency, 'ok');
      const completion: ChatCompletion = {
        id: ctx.id,
        object: 'chat.completion',
        created: ctx.created,
        model: a.candidate.model.id,
        provider: a.candidate.endpoint.provider,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: result.content, ...(result.toolCalls ? { tool_calls: result.toolCalls as never } : {}) },
            finish_reason: result.finishReason,
          },
        ],
        usage: {
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.promptTokens + usage.completionTokens,
          cost: toUsd(cost),
        },
      };
      return new Response(JSON.stringify(completion), { headers: { 'Content-Type': 'application/json', ...routeHeaders(a) } });
    } catch (err) {
      lastErr = asProviderError(err);
      if (lastErr.retryable) {
        deps.health.failure(key);
        continue;
      }
      break;
    } finally {
      abort.clear();
    }
  }
  await settle(ctx, last, null, 0, 'error', lastErr?.code);
  return failureResponse(lastErr);
}

async function streamCompletion(ctx: Context): Promise<Response> {
  const { deps } = ctx;
  let lastErr: ProviderError | null = null;
  let last: Attempt = ctx.attempts[0]!;

  for (const a of ctx.attempts) {
    last = a;
    const key = endpointKey(a.candidate.endpoint);
    const started = Date.now();
    const abort = linkedAbort(ctx.clientSignal, deps.config.requestTimeoutMs);
    const iterator = a.adapter
      .stream(
        { upstreamModel: a.candidate.endpoint.upstreamModel, messages: ctx.body.messages, maxTokens: ctx.maxTokens, params: ctx.params },
        abort.signal,
      )
      [Symbol.asyncIterator]();

    // Fallback is only possible before the first byte reaches the client.
    let first: IteratorResult<StreamEvent>;
    let firstTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      first = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          firstTimer = setTimeout(() => {
            abort.abort();
            reject(Object.assign(new Error('No response before the first-byte timeout'), { name: 'AbortError' }));
          }, deps.config.firstByteTimeoutMs);
        }),
      ]);
    } catch (err) {
      abort.clear();
      lastErr = asProviderError(err);
      if (lastErr.retryable) {
        deps.health.failure(key);
        continue;
      }
      break;
    } finally {
      clearTimeout(firstTimer);
    }

    const encoder = new TextEncoder();
    const base = { id: ctx.id, object: 'chat.completion.chunk' as const, created: ctx.created, model: a.candidate.model.id, provider: a.candidate.endpoint.provider };
    const includeUsage = ctx.body.stream_options?.include_usage === true;

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let open = true;
        const write = (s: string) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(s));
          } catch {
            open = false;
          }
        };
        const send = (chunk: ChatCompletionChunk) => write(`data: ${JSON.stringify(chunk)}\n\n`);

        let text = '';
        let usage: UpstreamUsage | null = null;
        let finishSent = false;
        let status: 'ok' | 'error' = 'ok';
        let errorCode: string | undefined;
        const handle = (ev: StreamEvent) => {
          if (ev.type === 'delta') {
            if (ev.content) text += ev.content;
            send({ ...base, choices: [{ index: 0, delta: { content: ev.content ?? null, ...(ev.toolCalls ? { tool_calls: ev.toolCalls } : {}) }, finish_reason: null }] });
          } else if (ev.type === 'finish') {
            finishSent = true;
            send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: ev.finishReason }] });
          } else {
            usage = ev.usage;
          }
        };

        send({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
        try {
          let r = first;
          while (!r.done) {
            handle(r.value);
            r = await iterator.next();
          }
          deps.health.success(key, Date.now() - started);
        } catch (err) {
          const pe = asProviderError(err);
          status = 'error';
          errorCode = ctx.clientSignal.aborted ? 'client_closed' : pe.code;
          if (!ctx.clientSignal.aborted) {
            deps.health.failure(key);
            write(`data: ${JSON.stringify({ error: { message: pe.message, type: 'upstream_error', code: pe.code } })}\n\n`);
          }
        } finally {
          abort.clear();
          if (!finishSent) send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: status === 'ok' ? 'stop' : null }] });
          // Bill what was generated, even if the stream broke part-way.
          const finalUsage: UpstreamUsage = usage ?? { promptTokens: ctx.promptEstimate, completionTokens: estimateTokens(text) };
          const cost = await settle(ctx, a, finalUsage, Date.now() - started, status, errorCode);
          if (includeUsage) {
            send({
              ...base,
              choices: [],
              usage: {
                prompt_tokens: finalUsage.promptTokens,
                completion_tokens: finalUsage.completionTokens,
                total_tokens: finalUsage.promptTokens + finalUsage.completionTokens,
                cost: toUsd(cost),
              },
            });
          }
          write('data: [DONE]\n\n');
          if (open) {
            try {
              controller.close();
            } catch {
              // already closed by the client
            }
          }
        }
      },
      cancel: () => {
        abort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...routeHeaders(a),
      },
    });
  }

  await settle(ctx, last, null, 0, 'error', lastErr?.code);
  return failureResponse(lastErr);
}
