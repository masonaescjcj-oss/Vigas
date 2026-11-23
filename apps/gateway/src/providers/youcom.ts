import { estimateTokens, messageText, type ChatMessage } from '@vigas/core';
import { ProviderError, type ProviderAdapter, type StreamEvent, type UpstreamRequest, type UpstreamResult } from './types';

export interface YouComSource {
  url: string;
  title?: string;
}

interface YouComOutputItem {
  type?: string;
  text?: unknown;
  content?: unknown;
}

interface YouComRunResponse {
  output?: unknown;
  error?: { message?: string } | string;
}

/** Normalizes `https://api.you.com` or `https://api.you.com/v1` to `/v1/agents/runs`. */
export function youComRunsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (/\/v1\/agents\/runs$/i.test(clean)) return clean;
  return clean.endsWith('/v1') ? `${clean}/agents/runs` : `${clean}/v1/agents/runs`;
}

/**
 * Converts OpenAI-style chat messages to the You.com Agents API `input` format.
 * You.com accepts a plain string for single-turn queries, or an array of `{ role: 'user' | 'agent', content }`
 * turns for multi-turn conversations (it rejects `'system'` and `'assistant'`).
 */
export function toYouComInput(messages: ChatMessage[]): string | Array<{ role: 'user' | 'agent'; content: string }> {
  const systemParts: string[] = [];
  const turns: Array<{ role: 'user' | 'agent'; content: string }> = [];

  for (const m of messages) {
    const text = messageText(m.content).trim();
    if (!text) continue;
    if (m.role === 'system') {
      systemParts.push(text);
    } else if (m.role === 'assistant') {
      turns.push({ role: 'agent', content: text });
    } else {
      turns.push({ role: 'user', content: text });
    }
  }

  const systemPrefix = systemParts.length ? `Instructions:\n${systemParts.join('\n')}\n\n` : '';
  if (turns.length === 0) return systemPrefix.trim() || 'Hello';
  if (turns.length === 1) return `${systemPrefix}${turns[0]!.content}`.trim();

  if (systemPrefix) {
    const firstUser = turns.find((t) => t.role === 'user');
    if (firstUser) firstUser.content = `${systemPrefix}${firstUser.content}`;
    else turns.unshift({ role: 'user', content: systemPrefix.trim() });
  }
  return turns;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Extracts the answer text and cited sources from a You.com agent run payload. */
export function parseYouComOutput(output: unknown): { text: string; sources: Array<YouComSource & { n: number }> } {
  let rawText = '';
  const results: YouComSource[] = [];
  if (Array.isArray(output)) {
    for (const item of output as YouComOutputItem[]) {
      if (!item || typeof item !== 'object') continue;
      if (item.type === 'message.answer' && typeof item.text === 'string') {
        rawText += (rawText ? '\n\n' : '') + item.text;
      } else if (typeof item.type === 'string' && item.type.includes('search') && Array.isArray(item.content)) {
        for (const hit of item.content as Array<Record<string, unknown>>) {
          const url = typeof hit?.url === 'string' ? hit.url : typeof hit?.citation_uri === 'string' ? hit.citation_uri : null;
          if (!url) continue;
          results.push({ url, title: typeof hit.title === 'string' ? hit.title : undefined });
        }
      }
    }
  }

  const titleByUrl = new Map(results.map((r) => [r.url, r.title]));
  const cited = new Map<string, number>();

  let text = rawText
    .replace(/\[\[(\d+)\]\]\((https?:\/\/[^\s)]+)\)/g, (_m, n: string, url: string) => {
      if (!cited.has(url)) cited.set(url, Number(n));
      return `[${cited.get(url)}]`;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const sources = [...cited.entries()]
    .map(([url, n]) => ({ n, url, title: titleByUrl.get(url) }))
    .sort((a, b) => a.n - b.n);

  if (sources.length > 0 && text) {
    const lines = sources.map((s) => `[${s.n}] ${s.title ? `${s.title} — ` : ''}${domainOf(s.url)} (${s.url})`);
    text += `\n\nSources:\n${lines.join('\n')}`;
  }

  return { text, sources };
}

function sanitizeErrorText(text: string, baseUrl: string, slug: string): string {
  let out = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const host = new URL(baseUrl).host;
    if (host) out = out.replace(new RegExp(host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'upstream');
  } catch {
    // ignore malformed baseUrl
  }
  out = out.replace(/you\.com/gi, 'upstream');
  out = out.replace(new RegExp(`\\b${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), 'upstream');
  return out.slice(0, 240);
}

/**
 * You.com Agents API adapter (`POST /v1/agents/runs`).
 * Works seamlessly behind `MultiKeyAdapter` so 10+ $100 keys rotate automatically.
 */
export class YouComAdapter implements ProviderAdapter {
  private readonly errorLabel: string;

  constructor(
    readonly slug: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
    errorLabel?: string,
  ) {
    this.errorLabel = errorLabel || slug;
  }

  async complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult> {
    const input = toYouComInput(req.messages);
    const agent = req.upstreamModel || 'express';
    const res = await this.fetcher(youComRunsUrl(this.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        agent,
        input,
        stream: false,
        tools: [{ type: 'web_search' }],
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let msg = body;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } | string; detail?: string; message?: string };
        msg =
          (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message) ??
          parsed.detail ??
          parsed.message ??
          body;
      } catch {
        // non-JSON (e.g. Cloudflare HTML challenge)
      }
      const clean = sanitizeErrorText(msg || `HTTP ${res.status}`, this.baseUrl, this.slug);
      throw ProviderError.fromStatus(res.status, `${this.errorLabel}: ${clean}`);
    }

    const data = (await res.json()) as YouComRunResponse;
    const { text } = parseYouComOutput(data.output);
    const inputText = typeof input === 'string' ? input : input.map((t) => t.content).join('\n');
    const promptTokens = estimateTokens(inputText);
    const completionTokens = estimateTokens(text);

    return {
      content: text || null,
      finishReason: 'stop',
      usage: { promptTokens, completionTokens },
    };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const result = await this.complete(req, signal);
    const text = result.content ?? '';
    // Emit in small natural chunks so OpenAI and Anthropic SSE consumers stream smoothly.
    const chunkSize = 48;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield { type: 'delta', content: text.slice(i, i + chunkSize) };
    }
    yield { type: 'finish', finishReason: result.finishReason };
    if (result.usage) yield { type: 'usage', usage: result.usage };
  }
}
