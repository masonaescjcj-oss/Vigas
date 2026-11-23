import type { ChatMessage } from '@vigas/core';
import { randomBase62 } from '@vigas/core/server';
import { sseData } from './sse';
import { ProviderError, type FinishReason, type ProviderAdapter, type StreamEvent, type UpstreamRequest, type UpstreamResult, type UpstreamUsage } from './types';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}

interface OpenAIToolCallLike {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAIToolDef {
  type?: string;
  function?: { name: string; description?: string; parameters?: Record<string, unknown> };
}

const FINISH_MAP: Record<string, FinishReason> = {
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'content_filter',
  RECITATION: 'content_filter',
  BLOCKLIST: 'content_filter',
  PROHIBITED_CONTENT: 'content_filter',
};

/**
 * Normalizes any Google Gemini base URL (`https://generativelanguage.googleapis.com`,
 * `.../v1beta`, or legacy `.../v1beta/openai`) to the native Gemini REST endpoint.
 * Native REST with `x-goog-api-key` supports BOTH legacy `AIza...` keys and 2026 `AQ....` Auth Keys.
 */
export function geminiEndpointUrl(baseUrl: string, model: string, stream: boolean): string {
  const stripped = baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/openai(?:\/v1)?$/i, '')
    .replace(/\/v1beta$/i, '')
    .replace(/\/v1$/i, '');
  const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  return `${stripped}/v1beta/models/${encodeURIComponent(model)}:${action}`;
}

function stripUnsupportedSchemaFields(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(stripUnsupportedSchemaFields);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === '$schema' || k === 'additionalProperties' || k === '$defs' || k === 'definitions') continue;
    out[k] = stripUnsupportedSchemaFields(v);
  }
  return out;
}

function toGeminiParts(content: ChatMessage['content']): GeminiPart[] {
  if (typeof content === 'string') return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [];
  const parts: GeminiPart[] = [];
  for (const p of content) {
    if (p.type === 'text' && p.text) {
      parts.push({ text: p.text });
    } else if (p.type === 'image_url' && p.image_url?.url) {
      const m = /^data:([^;]+);base64,(.+)$/.exec(p.image_url.url);
      if (m?.[1] && m[2]) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
      else parts.push({ text: `[image: ${p.image_url.url}]` });
    }
  }
  return parts;
}

export function toGeminiPayload(req: UpstreamRequest): Record<string, unknown> {
  const systemTexts: string[] = [];
  const contents: GeminiContent[] = [];
  const callNames = new Map<string, string>();

  const push = (role: 'user' | 'model', parts: GeminiPart[]) => {
    if (parts.length === 0) return;
    const prev = contents.at(-1);
    if (prev && prev.role === role) prev.parts.push(...parts);
    else contents.push({ role, parts });
  };

  for (const m of req.messages) {
    if (m.role === 'system') {
      const text = typeof m.content === 'string' ? m.content : toGeminiParts(m.content).map((p) => p.text ?? '').join('\n');
      if (text.trim()) systemTexts.push(text.trim());
      continue;
    }

    if (m.role === 'assistant') {
      const parts = toGeminiParts(m.content);
      const calls = ((m as { tool_calls?: OpenAIToolCallLike[] }).tool_calls ?? []);
      for (const tc of calls) {
        const name = tc.function?.name || 'tool';
        if (tc.id) callNames.set(tc.id, name);
        let args: Record<string, unknown> = {};
        if (tc.function?.arguments) {
          try {
            const parsed = JSON.parse(tc.function.arguments);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
          } catch {
            // keep empty args
          }
        }
        parts.push({ functionCall: { name, args } });
      }
      push('model', parts);
      continue;
    }

    if (m.role === 'tool') {
      const toolCallId = (m as { tool_call_id?: string }).tool_call_id ?? '';
      const name = callNames.get(toolCallId) || 'tool';
      const rawText = typeof m.content === 'string' ? m.content : toGeminiParts(m.content).map((p) => p.text ?? '').join('\n');
      let responseObj: Record<string, unknown> = { output: rawText };
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) responseObj = parsed as Record<string, unknown>;
      } catch {
        // wrap string output
      }
      push('user', [{ functionResponse: { name, response: responseObj } }]);
      continue;
    }

    push('user', toGeminiParts(m.content));
  }

  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: 'Hello' }] });

  const generationConfig: Record<string, unknown> = { maxOutputTokens: req.maxTokens };
  if (typeof req.params.temperature === 'number') generationConfig.temperature = req.params.temperature;
  if (typeof req.params.top_p === 'number') generationConfig.topP = req.params.top_p;
  if (typeof req.params.stop === 'string') generationConfig.stopSequences = [req.params.stop];
  else if (Array.isArray(req.params.stop)) generationConfig.stopSequences = req.params.stop;

  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemTexts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] };
  }

  if (Array.isArray(req.params.tools) && req.params.tools.length > 0) {
    const decls = (req.params.tools as OpenAIToolDef[])
      .filter((t) => t?.type === 'function' && t.function?.name)
      .map((t) => ({
        name: t.function!.name,
        ...(t.function!.description ? { description: t.function!.description } : {}),
        ...(t.function!.parameters ? { parameters: stripUnsupportedSchemaFields(t.function!.parameters) } : {}),
      }));
    if (decls.length > 0) body.tools = [{ functionDeclarations: decls }];
  }

  return body;
}

function parseUsage(meta: GeminiResponse['usageMetadata']): UpstreamUsage | null {
  if (!meta) return null;
  const promptTokens = meta.promptTokenCount ?? 0;
  const completionTokens = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
  const cached = meta.cachedContentTokenCount ?? 0;
  return {
    promptTokens,
    completionTokens,
    ...(cached > 0 ? { cachedPromptTokens: cached } : {}),
  };
}

function sanitizeHost(raw: string, baseUrl: string): string {
  try {
    const host = new URL(baseUrl).host;
    return host ? raw.replaceAll(host, 'upstream') : raw;
  } catch {
    return raw;
  }
}

/**
 * Native Google Gemini REST adapter (`x-goog-api-key` auth).
 * Works seamlessly with BOTH legacy `AIza...` keys and 2026 `AQ....` Google AI Studio Auth Keys.
 */
export class GeminiAdapter implements ProviderAdapter {
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

  private async post(req: UpstreamRequest, stream: boolean, signal: AbortSignal): Promise<Response> {
    if (!this.baseUrl) throw new ProviderError(`Provider "${this.label}" has no base URL configured`, 503, true, 'provider_not_configured');
    const res = await this.fetchImpl(geminiEndpointUrl(this.baseUrl, req.upstreamModel, stream), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(toGeminiPayload(req)),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text.slice(0, 600) || res.statusText;
      try {
        const parsed = JSON.parse(text) as
          | { error?: { message?: string; status?: string; details?: unknown } }
          | Array<{ error?: { message?: string; status?: string; details?: unknown } }>;
        const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
        if (errObj?.message) {
          const quotaHint = errObj.details ? JSON.stringify(errObj.details).match(/GenerateRequestsPerDay[^\s"']*|PerDay/i)?.[0] : null;
          const prefix = [errObj.status, quotaHint].filter(Boolean).join(' ');
          message = prefix ? `${prefix}: ${errObj.message}` : errObj.message;
        }
      } catch {
        // keep raw text
      }
      throw ProviderError.fromStatus(res.status, `${this.label}: ${sanitizeHost(message, this.baseUrl)}`);
    }
    return res;
  }

  async complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult> {
    const res = await this.post(req, false, signal);
    const json = (await res.json()) as GeminiResponse;
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    let text = '';
    const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
    for (const part of parts) {
      if (part.thought) continue;
      if (part.text) text += part.text;
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `call_${randomBase62(12)}`,
          type: 'function',
          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
        });
      }
    }

    const mappedReason = candidate?.finishReason ? (FINISH_MAP[candidate.finishReason] ?? 'stop') : 'stop';
    return {
      content: text || null,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      finishReason: toolCalls.length > 0 ? 'tool_calls' : mappedReason,
      usage: parseUsage(json.usageMetadata),
    };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const res = await this.post(req, true, signal);
    if (!res.body) throw new ProviderError(`${this.label}: empty stream`, 502, true);

    let toolIndex = 0;
    let sawToolCalls = false;
    let lastUsage: UpstreamUsage | null = null;
    let finishReason: FinishReason = null;

    for await (const data of sseData(res.body)) {
      if (data === '[DONE]') break;
      let chunk: GeminiResponse;
      try {
        chunk = JSON.parse(data) as GeminiResponse;
      } catch {
        continue;
      }

      if (chunk.usageMetadata) lastUsage = parseUsage(chunk.usageMetadata);
      const candidate = chunk.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought) continue;
        if (part.text) {
          yield { type: 'delta', content: part.text };
        }
        if (part.functionCall?.name) {
          sawToolCalls = true;
          yield {
            type: 'delta',
            toolCalls: [
              {
                index: toolIndex++,
                id: `call_${randomBase62(12)}`,
                type: 'function',
                function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
              },
            ],
          };
        }
      }
      if (candidate?.finishReason) {
        finishReason = sawToolCalls ? 'tool_calls' : (FINISH_MAP[candidate.finishReason] ?? 'stop');
      }
    }

    yield { type: 'finish', finishReason: finishReason ?? (sawToolCalls ? 'tool_calls' : 'stop') };
    if (lastUsage) yield { type: 'usage', usage: lastUsage };
  }
}
