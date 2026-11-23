import {
  costMicros,
  endpointKey,
  estimateMaxCostMicros,
  estimateTokens,
  messageText,
  planRoute,
  resolveModelId,
  RouteError,
  type ChatMessage,
  type RouteCandidate,
} from '@vigas/core';
import { randomBase62 } from '@vigas/core/server';
import { keySpendThisMonth, reserveCredits, settleUsage } from '@vigas/db';
import { authenticate, type Caller } from './auth';
import { checkPromoCreditScope, customerPrice, type GatewayDeps } from './chat';
import { isProviderAllowedForModel, publicProviderLabel } from './config';
import { asProviderError, type ProviderAdapter, type ProviderError, type StreamEvent, type UpstreamUsage } from './providers';
import type { OpenAIToolCall } from './providers/anthropic';

/**
 * Native Anthropic Messages API (`POST /v1/messages`) served by Vigas.
 *
 * Lets Claude Code and Anthropic SDK customers point `ANTHROPIC_BASE_URL=https://api.vigas.ai`
 * with their Vigas key (`sk-vg-v1-...`). Vigas authenticates the key, bills credits, routes across
 * all configured upstream pools (including `sevenapi` and any OpenAI- or Anthropic-compatible
 * providers) with automatic failover, and never exposes upstream credentials or hosts.
 */

interface AnthropicInputBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | Array<{ type?: string; text?: string }>;
  source?: { type?: string; url?: string; media_type?: string; data?: string };
}

interface AnthropicInputMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicInputBlock[];
}

interface AnthropicInputTool {
  name: string;
  description?: string;
  input_schema?: unknown;
}

interface AnthropicMessagesBody {
  model?: unknown;
  max_tokens?: unknown;
  system?: unknown;
  messages?: unknown;
  stream?: unknown;
  temperature?: unknown;
  top_p?: unknown;
  stop_sequences?: unknown;
  tools?: unknown;
  tool_choice?: unknown;
}

const STOP_TO_ANTHROPIC: Record<string, string> = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
  content_filter: 'refusal',
};

function anthropicError(status: number, type: string, message: string, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function extractText(content: string | AnthropicInputBlock[] | undefined): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((b) => (b?.type === 'text' ? (b.text ?? '') : '')).join('');
}

/** Converts an Anthropic Messages request into Vigas's internal OpenAI-shaped message list. */
export function fromAnthropicMessages(system: unknown, messages: AnthropicInputMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (typeof system === 'string' && system.trim()) {
    out.push({ role: 'system', content: system });
  } else if (Array.isArray(system)) {
    const text = (system as AnthropicInputBlock[]).map((b) => b?.text ?? '').filter(Boolean).join('\n\n');
    if (text) out.push({ role: 'system', content: text });
  }

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (!Array.isArray(m.content)) continue;

    if (m.role === 'assistant') {
      const text = extractText(m.content);
      const toolCalls = m.content
        .filter((b) => b?.type === 'tool_use' && b.name)
        .map((b) => ({
          id: b.id ?? `toolu_${randomBase62(12)}`,
          type: 'function' as const,
          function: { name: b.name!, arguments: JSON.stringify(b.input ?? {}) },
        }));
      out.push({
        role: 'assistant',
        content: text || (toolCalls.length ? '' : ' '),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    // User messages may contain text, images, and/or tool_result blocks.
    const toolResults = m.content.filter((b) => b?.type === 'tool_result' && b.tool_use_id);
    for (const tr of toolResults) {
      const trText = typeof tr.content === 'string' ? tr.content : extractText(tr.content as AnthropicInputBlock[]);
      out.push({ role: 'tool', tool_call_id: tr.tool_use_id!, content: trText });
    }
    const nonTool = m.content.filter((b) => b?.type !== 'tool_result');
    if (nonTool.length > 0) {
      const hasImages = nonTool.some((b) => b?.type === 'image');
      if (!hasImages) {
        const text = extractText(nonTool);
        if (text) out.push({ role: 'user', content: text });
      } else {
        const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        for (const b of nonTool) {
          if (b?.type === 'text' && b.text) parts.push({ type: 'text', text: b.text });
          else if (b?.type === 'image' && b.source) {
            const url =
              b.source.type === 'base64' && b.source.data
                ? `data:${b.source.media_type ?? 'image/png'};base64,${b.source.data}`
                : b.source.url;
            if (url) parts.push({ type: 'image_url', image_url: { url } });
          }
        }
        if (parts.length > 0) out.push({ role: 'user', content: parts });
      }
    }
  }
  return out;
}

function fromAnthropicTools(tools: unknown): unknown[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return (tools as AnthropicInputTool[])
    .filter((t) => typeof t?.name === 'string' && t.name.length > 0)
    .map((t) => ({
      type: 'function',
      function: { name: t.name, ...(t.description ? { description: t.description } : {}), parameters: t.input_schema ?? { type: 'object', properties: {} } },
    }));
}

function fromAnthropicToolChoice(choice: unknown): unknown {
  if (!choice || typeof choice !== 'object') return undefined;
  const c = choice as { type?: string; name?: string };
  if (c.type === 'auto') return 'auto';
  if (c.type === 'any') return 'required';
  if (c.type === 'none') return 'none';
  if (c.type === 'tool' && c.name) return { type: 'function', function: { name: c.name } };
  return undefined;
}

interface Attempt {
  candidate: RouteCandidate;
  adapter: ProviderAdapter;
}

function linkedAbort(parent: AbortSignal, timeoutMs: number) {
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

function toAnthropicContentBlocks(content: string | null, toolCalls?: unknown[]) {
  const blocks: Array<Record<string, unknown>> = [];
  if (content) blocks.push({ type: 'text', text: content });
  for (const raw of (toolCalls ?? []) as OpenAIToolCall[]) {
    let parsedInput: unknown = {};
    try {
      parsedInput = raw.function?.arguments ? JSON.parse(raw.function.arguments) : {};
    } catch {
      parsedInput = {};
    }
    blocks.push({
      type: 'tool_use',
      id: raw.id || `toolu_${randomBase62(12)}`,
      name: raw.function?.name ?? 'tool',
      input: parsedInput,
    });
  }
  if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
  return blocks;
}

function settleMessage(
  deps: GatewayDeps,
  caller: Caller,
  holdId: string,
  a: Attempt,
  usage: UpstreamUsage | null,
  latencyMs: number,
  status: 'ok' | 'error',
  errorCode?: string,
) {
  const cost = usage ? costMicros(usage, customerPrice(a.candidate)) : 0;
  return settleUsage(deps.db, {
    holdId,
    accountId: caller.accountId,
    apiKeyId: caller.apiKeyId,
    source: caller.source,
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
      console.error('[gateway] failed to settle messages usage', err);
      return cost;
    });
}

export async function handleAnthropicMessages(deps: GatewayDeps, req: Request): Promise<Response> {
  const auth = await authenticate(deps.db, deps.config, req.headers);
  if (!auth.ok) return anthropicError(auth.status, 'authentication_error', auth.message);
  const caller = auth.caller;

  const wait = deps.limiter.take(caller.limitKey);
  if (wait > 0) {
    return anthropicError(429, 'rate_limit_error', `Rate limit exceeded. Retry in ${wait}s.`, { 'Retry-After': String(wait) });
  }

  let body: AnthropicMessagesBody;
  try {
    body = (await req.json()) as AnthropicMessagesBody;
  } catch {
    return anthropicError(400, 'invalid_request_error', 'Request body must be valid JSON');
  }

  const rawModel = typeof body.model === 'string' ? body.model.trim() : '';
  if (!rawModel) return anthropicError(400, 'invalid_request_error', '"model" is required');
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return anthropicError(400, 'invalid_request_error', '"messages" must be a non-empty array');
  }

  const messages = fromAnthropicMessages(body.system, body.messages as AnthropicInputMessage[]);
  if (messages.length === 0) return anthropicError(400, 'invalid_request_error', '"messages" contained no valid blocks');

  const snap = await deps.catalog.get();
  const configuredEndpoints = snap.endpoints.filter(
    (e) => e.enabled && deps.adapters(e.provider) !== null && isProviderAllowedForModel(deps.config, e.provider, e.modelId),
  );
  const resolvedModel = resolveModelId(rawModel, snap.models, snap.endpoints) ?? rawModel;

  let plan: RouteCandidate[];
  try {
    plan = planRoute({
      model: resolvedModel,
      catalog: snap.models,
      endpoints: configuredEndpoints.length ? configuredEndpoints : snap.endpoints,
      ratings: snap.ratings,
      stats: deps.health.stats(),
    });
  } catch (err) {
    if (err instanceof RouteError) {
      return err.code === 'model_not_found'
        ? anthropicError(404, 'not_found_error', err.message)
        : anthropicError(503, 'api_error', err.message);
    }
    throw err;
  }

  const attempts = plan
    .filter((candidate) => isProviderAllowedForModel(deps.config, candidate.endpoint.provider, candidate.model.id))
    .map((candidate) => ({ candidate, adapter: deps.adapters(candidate.endpoint.provider) }))
    .filter((a): a is Attempt => a.adapter !== null);
  if (attempts.length === 0) {
    return anthropicError(503, 'api_error', `No provider is configured for "${rawModel}" yet`);
  }

  const maxTokens =
    typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens) && body.max_tokens > 0
      ? Math.min(Math.round(body.max_tokens), 128_000)
      : deps.config.defaultMaxTokens;
  const promptEstimate = messages.reduce((n, m) => n + estimateTokens(messageText(m.content)) + 4, 0);

  const reserve = Math.max(...attempts.map((a) => estimateMaxCostMicros(customerPrice(a.candidate), promptEstimate, maxTokens)));
  const promoBlock = await checkPromoCreditScope(
    deps,
    caller.accountId,
    attempts.map((a) => a.candidate.model.id),
    reserve,
  );
  if (promoBlock) {
    return anthropicError(402, 'invalid_request_error', promoBlock);
  }
  if (caller.apiKeyId && caller.monthlyLimitMicros !== null && reserve > 0) {
    const spent = await keySpendThisMonth(deps.db, caller.apiKeyId);
    if (spent + reserve > caller.monthlyLimitMicros) {
      return anthropicError(402, 'rate_limit_error', `Monthly spending cap of $${(caller.monthlyLimitMicros / 1e6).toFixed(2)} reached.`);
    }
  }
  const holdId = await reserveCredits(deps.db, caller.accountId, reserve);
  if (!holdId) {
    return anthropicError(402, 'invalid_request_error', 'Insufficient credits. Add credits at https://vigas.app/dashboard');
  }

  const params: Record<string, unknown> = {};
  if (typeof body.temperature === 'number') params.temperature = body.temperature;
  if (typeof body.top_p === 'number') params.top_p = body.top_p;
  if (Array.isArray(body.stop_sequences)) params.stop = body.stop_sequences;
  const tools = fromAnthropicTools(body.tools);
  if (tools) params.tools = tools;
  const toolChoice = fromAnthropicToolChoice(body.tool_choice);
  if (toolChoice) params.tool_choice = toolChoice;

  const msgId = `msg_${randomBase62(24)}`;
  const isStream = body.stream === true;
  let lastErr: ProviderError | null = null;
  let lastAttempt: Attempt = attempts[0]!;

  if (!isStream) {
    for (const a of attempts) {
      lastAttempt = a;
      const key = endpointKey(a.candidate.endpoint);
      const started = Date.now();
      const abort = linkedAbort(req.signal, deps.config.requestTimeoutMs);
      try {
        const result = await a.adapter.complete(
          { upstreamModel: a.candidate.endpoint.upstreamModel, messages, maxTokens, params },
          abort.signal,
        );
        const latency = Date.now() - started;
        deps.health.success(key, latency);
        const usage = result.usage ?? { promptTokens: promptEstimate, completionTokens: estimateTokens(result.content ?? '') };
        await settleMessage(deps, caller, holdId, a, usage, latency, 'ok');
        const cached = usage.cachedPromptTokens ?? 0;
        const payload = {
          id: msgId,
          type: 'message',
          role: 'assistant',
          model: a.candidate.model.id,
          content: toAnthropicContentBlocks(result.content, result.toolCalls),
          stop_reason: (result.finishReason && STOP_TO_ANTHROPIC[result.finishReason]) || 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: Math.max(0, usage.promptTokens - cached),
            output_tokens: usage.completionTokens,
            ...(cached > 0 ? { cache_read_input_tokens: cached } : {}),
          },
        };
        return new Response(JSON.stringify(payload), {
          headers: {
            'Content-Type': 'application/json',
            'X-Vigas-Provider': publicProviderLabel(deps.config, a.candidate.endpoint.provider),
            'X-Vigas-Model': a.candidate.model.id,
          },
        });
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
    await settleMessage(deps, caller, holdId, lastAttempt, null, 0, 'error', lastErr?.code);
    return anthropicError(lastErr?.status ?? 502, lastErr?.status === 429 ? 'rate_limit_error' : 'api_error', lastErr?.message ?? 'All providers failed');
  }

  // Streaming Anthropic SSE response
  for (const a of attempts) {
    lastAttempt = a;
    const key = endpointKey(a.candidate.endpoint);
    const started = Date.now();
    const abort = linkedAbort(req.signal, deps.config.requestTimeoutMs);
    const iterator = a.adapter
      .stream({ upstreamModel: a.candidate.endpoint.upstreamModel, messages, maxTokens, params }, abort.signal)
      [Symbol.asyncIterator]();

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
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let open = true;
        const emit = (event: string, data: unknown) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            open = false;
          }
        };

        let text = '';
        let textBlockOpen = false;
        let nextBlockIndex = 0;
        let textBlockIndex = 0;
        const toolBlocks = new Map<number, number>();
        let stopReason = 'end_turn';
        let usage: UpstreamUsage | null = null;
        let status: 'ok' | 'error' = 'ok';
        let errorCode: string | undefined;

        emit('message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            model: a.candidate.model.id,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: promptEstimate, output_tokens: 0 },
          },
        });

        const handle = (ev: StreamEvent) => {
          if (ev.type === 'delta') {
            if (ev.content) {
              if (!textBlockOpen) {
                textBlockIndex = nextBlockIndex++;
                textBlockOpen = true;
                emit('content_block_start', { type: 'content_block_start', index: textBlockIndex, content_block: { type: 'text', text: '' } });
              }
              text += ev.content;
              emit('content_block_delta', { type: 'content_block_delta', index: textBlockIndex, delta: { type: 'text_delta', text: ev.content } });
            }
            if (Array.isArray(ev.toolCalls)) {
              if (textBlockOpen) {
                emit('content_block_stop', { type: 'content_block_stop', index: textBlockIndex });
                textBlockOpen = false;
              }
              for (const tc of ev.toolCalls as Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>) {
                const idx = tc.index ?? 0;
                let blockIdx = toolBlocks.get(idx);
                if (blockIdx === undefined) {
                  blockIdx = nextBlockIndex++;
                  toolBlocks.set(idx, blockIdx);
                  emit('content_block_start', {
                    type: 'content_block_start',
                    index: blockIdx,
                    content_block: { type: 'tool_use', id: tc.id ?? `toolu_${randomBase62(10)}`, name: tc.function?.name ?? 'tool', input: {} },
                  });
                }
                if (tc.function?.arguments) {
                  emit('content_block_delta', {
                    type: 'content_block_delta',
                    index: blockIdx,
                    delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
                  });
                }
              }
            }
          } else if (ev.type === 'finish') {
            stopReason = (ev.finishReason && STOP_TO_ANTHROPIC[ev.finishReason]) || 'end_turn';
          } else {
            usage = ev.usage;
          }
        };

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
          errorCode = req.signal.aborted ? 'client_closed' : pe.code;
          if (!req.signal.aborted) {
            deps.health.failure(key);
            emit('error', { type: 'error', error: { type: 'api_error', message: pe.message } });
          }
        } finally {
          abort.clear();
          if (textBlockOpen) emit('content_block_stop', { type: 'content_block_stop', index: textBlockIndex });
          for (const blockIdx of toolBlocks.values()) emit('content_block_stop', { type: 'content_block_stop', index: blockIdx });
          const finalUsage: UpstreamUsage = usage ?? { promptTokens: promptEstimate, completionTokens: estimateTokens(text) };
          await settleMessage(deps, caller, holdId, a, finalUsage, Date.now() - started, status, errorCode);
          emit('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: stopReason, stop_sequence: null },
            usage: { output_tokens: finalUsage.completionTokens },
          });
          emit('message_stop', { type: 'message_stop' });
          if (open) {
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        }
      },
      cancel: () => abort.abort(),
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Vigas-Provider': publicProviderLabel(deps.config, a.candidate.endpoint.provider),
        'X-Vigas-Model': a.candidate.model.id,
      },
    });
  }

  await settleMessage(deps, caller, holdId, lastAttempt, null, 0, 'error', lastErr?.code);
  return anthropicError(lastErr?.status ?? 502, lastErr?.status === 429 ? 'rate_limit_error' : 'api_error', lastErr?.message ?? 'All providers failed');
}
