import type { GatewayConfig, ProviderConfig } from '../config';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';
import { KeyPool, MultiKeyAdapter, type KeyPoolSnapshot } from './key-pool';
import { MockAdapter } from './mock';
import { OpenAICompatibleAdapter } from './openai-compatible';
import type { ProviderAdapter } from './types';
import { YouComAdapter } from './youcom';

export type AdapterResolver = ((provider: string) => ProviderAdapter | null) & {
  poolSnapshots?: () => Record<string, KeyPoolSnapshot>;
};

function buildSingleAdapter(p: ProviderConfig, apiKey: string, errorLabel: string, fetcher: typeof fetch): ProviderAdapter {
  if (p.kind === 'anthropic') return new AnthropicAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  if (p.kind === 'gemini') return new GeminiAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  if (p.kind === 'youcom') return new YouComAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  return new OpenAICompatibleAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
}

/**
 * Real adapters for providers with one or more API keys (automatically wrapped in a rotating
 * `MultiKeyAdapter` when multiple keys or per-key budgets are configured); the mock adapter for
 * the rest when `mockProviders` is on; otherwise null (the endpoint is skipped).
 */
export function createAdapterResolver(
  config: GatewayConfig,
  opts: { failing?: Set<string>; fetcher?: typeof fetch } = {},
): AdapterResolver {
  const fetcher = opts.fetcher ?? fetch;
  const cache = new Map<string, ProviderAdapter | null>();
  const pools = new Map<string, KeyPool>();

  const resolve = ((provider: string) => {
    if (cache.has(provider)) return cache.get(provider)!;
    const p = config.providers[provider];
    let adapter: ProviderAdapter | null = null;
    const keys = p?.apiKeys?.length ? p.apiKeys : p?.apiKey ? [{ key: p.apiKey, label: `${provider}-01` }] : [];

    if (p && keys.length > 0) {
      const errorLabel = p.hidden || config.hideUpstreamProviders ? (p.publicLabel ?? 'vigas-edge') : provider;
      if (keys.length > 1 || keys.some((k) => k.budgetMicros != null)) {
        const pool = new KeyPool(keys, { strategy: p.keyStrategy });
        pools.set(provider, pool);
        adapter = new MultiKeyAdapter(provider, pool, (apiKey) => buildSingleAdapter(p, apiKey, errorLabel, fetcher));
      } else {
        adapter = buildSingleAdapter(p, keys[0]!.key, errorLabel, fetcher);
      }
    } else if (config.mockProviders && p?.allowMock !== false) {
      adapter = new MockAdapter(provider, { failing: opts.failing });
    }
    cache.set(provider, adapter);
    return adapter;
  }) as AdapterResolver;

  resolve.poolSnapshots = () => {
    // Initialize any configured multi-key pools so admin diagnostics reflect them even before first request.
    for (const [slug, p] of Object.entries(config.providers)) {
      if (p.apiKeys.length > 1 || p.apiKeys.some((k) => k.budgetMicros != null)) resolve(slug);
    }
    const out: Record<string, KeyPoolSnapshot> = {};
    for (const [slug, pool] of pools.entries()) out[slug] = pool.snapshot();
    return out;
  };

  return resolve;
}

export * from './gemini';
export * from './key-pool';
export * from './types';
export * from './youcom';
