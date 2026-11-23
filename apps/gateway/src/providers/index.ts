import { loadActiveUpstreamProviders, type Db } from '@vigas/db';
import type { GatewayConfig, ProviderConfig } from '../config';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';
import { KeyPool, MultiKeyAdapter, type KeyPoolSnapshot, type PoolKeySpec } from './key-pool';
import { MockAdapter } from './mock';
import { OpenAICompatibleAdapter } from './openai-compatible';
import type { ProviderAdapter } from './types';
import { YouComAdapter } from './youcom';

export type AdapterResolver = ((provider: string) => ProviderAdapter | null) & {
  poolSnapshots?: () => Record<string, KeyPoolSnapshot>;
  reloadFromDb?: () => Promise<{ syncedProviders: number; totalDbKeys: number }>;
};

function buildSingleAdapter(p: ProviderConfig, apiKey: string, errorLabel: string, fetcher: typeof fetch): ProviderAdapter {
  if (p.kind === 'anthropic') return new AnthropicAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  if (p.kind === 'gemini') return new GeminiAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  if (p.kind === 'youcom') return new YouComAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
  return new OpenAICompatibleAdapter(p.slug, p.baseUrl, apiKey, fetcher, errorLabel);
}

function mergeKeySpecs(primary: PoolKeySpec[], secondary: PoolKeySpec[]): PoolKeySpec[] {
  const seen = new Set<string>();
  const out: PoolKeySpec[] = [];
  for (const k of [...primary, ...secondary]) {
    const clean = k.key.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push({ ...k, key: clean });
  }
  return out;
}

/**
 * Real adapters for providers with one or more API keys (automatically wrapped in a rotating
 * `MultiKeyAdapter` when multiple keys or per-key budgets are configured); the mock adapter for
 * the rest when `mockProviders` is on; otherwise null (the endpoint is skipped).
 *
 * When `db` is supplied, also syncs admin-managed `upstream_providers` and `upstream_keys` from
 * Postgres and merges them live with env-configured providers on startup and on-demand reload.
 */
export function createAdapterResolver(
  config: GatewayConfig,
  opts: { failing?: Set<string>; fetcher?: typeof fetch; db?: Db } = {},
): AdapterResolver {
  const fetcher = opts.fetcher ?? fetch;
  const baseProviders: Record<string, ProviderConfig> = {};
  for (const [slug, p] of Object.entries(config.providers)) {
    baseProviders[slug] = { ...p, apiKeys: [...p.apiKeys], allowedModels: p.allowedModels ? [...p.allowedModels] : null };
  }

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
    for (const [slug, p] of Object.entries(config.providers)) {
      if (p.apiKeys.length > 1 || p.apiKeys.some((k) => k.budgetMicros != null)) resolve(slug);
    }
    const out: Record<string, KeyPoolSnapshot> = {};
    for (const [slug, pool] of pools.entries()) out[slug] = pool.snapshot();
    return out;
  };

  resolve.reloadFromDb = async () => {
    if (!opts.db) return { syncedProviders: 0, totalDbKeys: 0 };
    try {
      const dbProviders = await loadActiveUpstreamProviders(opts.db, config.internalServiceToken);
      const nextProviders: Record<string, ProviderConfig> = {};
      for (const [slug, p] of Object.entries(baseProviders)) {
        nextProviders[slug] = { ...p, apiKeys: [...p.apiKeys], allowedModels: p.allowedModels ? [...p.allowedModels] : null };
      }

      let totalDbKeys = 0;
      for (const row of dbProviders) {
        totalDbKeys += row.keys.length;
        const envBase = nextProviders[row.slug];
        if (!row.enabled) {
          // Disabled in Admin Panel: clear active keys so router skips this provider.
          nextProviders[row.slug] = {
            ...(envBase ?? {
              slug: row.slug,
              kind: row.kind,
              baseUrl: row.baseUrl,
              allowMock: false,
            }),
            apiKey: null,
            apiKeys: [],
            keyStrategy: row.keyStrategy,
            allowedModels: row.allowedModels,
            hidden: row.hidden,
            publicLabel: row.publicLabel,
            allowMock: false,
          };
          continue;
        }
        const mergedKeys = mergeKeySpecs(row.keys, envBase?.apiKeys ?? []);
        nextProviders[row.slug] = {
          slug: row.slug,
          kind: row.kind,
          baseUrl: row.baseUrl,
          apiKey: mergedKeys[0]?.key ?? null,
          apiKeys: mergedKeys,
          keyStrategy: row.keyStrategy,
          allowedModels: row.allowedModels,
          hidden: row.hidden,
          publicLabel: row.publicLabel,
          allowMock: envBase?.allowMock ?? false,
        };
      }

      // Swap provider map in-place and clear adapter/pool caches so changes take effect immediately.
      for (const k of Object.keys(config.providers)) delete config.providers[k];
      Object.assign(config.providers, nextProviders);
      cache.clear();
      pools.clear();
      return { syncedProviders: dbProviders.length, totalDbKeys };
    } catch {
      // Table may not exist yet before migration 0005 runs; stay safely on env providers.
      return { syncedProviders: 0, totalDbKeys: 0 };
    }
  };

  if (opts.db) {
    // Initial non-blocking sync + periodic 30s background refresh (unref'd so tests exit cleanly).
    void resolve.reloadFromDb();
    const timer = setInterval(() => void resolve.reloadFromDb?.(), 30_000);
    timer.unref?.();
  }

  return resolve;
}

export * from './gemini';
export * from './key-pool';
export * from './types';
export * from './youcom';
