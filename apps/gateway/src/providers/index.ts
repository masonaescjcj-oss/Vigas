import type { GatewayConfig } from '../config';
import { AnthropicAdapter } from './anthropic';
import { MockAdapter } from './mock';
import { OpenAICompatibleAdapter } from './openai-compatible';
import type { ProviderAdapter } from './types';

export type AdapterResolver = (provider: string) => ProviderAdapter | null;

/**
 * Real adapters for providers with an API key; the mock adapter for the rest when
 * `mockProviders` is on; otherwise null (the endpoint is skipped).
 */
export function createAdapterResolver(config: GatewayConfig, opts: { failing?: Set<string> } = {}): AdapterResolver {
  const cache = new Map<string, ProviderAdapter | null>();
  return (provider) => {
    if (cache.has(provider)) return cache.get(provider)!;
    const p = config.providers[provider];
    let adapter: ProviderAdapter | null = null;
    if (p?.apiKey) {
      adapter =
        p.kind === 'anthropic'
          ? new AnthropicAdapter(provider, p.baseUrl, p.apiKey)
          : new OpenAICompatibleAdapter(provider, p.baseUrl, p.apiKey);
    } else if (config.mockProviders) {
      adapter = new MockAdapter(provider, { failing: opts.failing });
    }
    cache.set(provider, adapter);
    return adapter;
  };
}

export * from './types';
