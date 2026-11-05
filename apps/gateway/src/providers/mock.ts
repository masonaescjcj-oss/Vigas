import { estimateTokens, messageText } from '@vigas/core';
import { ProviderError, type ProviderAdapter, type StreamEvent, type UpstreamRequest, type UpstreamResult } from './types';

/**
 * Stand-in provider for local development and tests. It answers every request with a short,
 * clearly labelled message and real-looking token usage. Providers listed in `failing` return
 * 503, which is how tests exercise fallbacks.
 */
export class MockAdapter implements ProviderAdapter {
  constructor(
    readonly slug: string,
    private readonly opts: { failing?: Set<string>; delayMs?: number } = {},
  ) {}

  private reply(req: UpstreamRequest): string {
    const last = [...req.messages].reverse().find((m) => m.role === 'user');
    const asked = messageText(last?.content).replace(/\s+/g, ' ').trim().slice(0, 120);
    return (
      `[mock ${this.slug} · ${req.upstreamModel}] This is a development response. ` +
      `Set ${this.slug.toUpperCase()}_API_KEY to get real answers. You asked: “${asked}”`
    );
  }

  private check() {
    if (this.opts.failing?.has(this.slug)) {
      throw new ProviderError(`${this.slug}: mock provider unavailable`, 503, true, 'upstream_unavailable');
    }
  }

  private usage(req: UpstreamRequest, text: string) {
    const prompt = req.messages.reduce((n, m) => n + estimateTokens(messageText(m.content)) + 4, 0);
    return { promptTokens: prompt, completionTokens: Math.min(req.maxTokens, estimateTokens(text)) };
  }

  async complete(req: UpstreamRequest): Promise<UpstreamResult> {
    this.check();
    const text = this.reply(req);
    return { content: text, finishReason: 'stop', usage: this.usage(req, text) };
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    this.check();
    const text = this.reply(req);
    const words = text.split(/(?<= )/);
    for (const w of words) {
      if (signal.aborted) return;
      if (this.opts.delayMs) await new Promise((r) => setTimeout(r, this.opts.delayMs));
      yield { type: 'delta', content: w };
    }
    yield { type: 'finish', finishReason: 'stop' };
    yield { type: 'usage', usage: this.usage(req, text) };
  }
}
