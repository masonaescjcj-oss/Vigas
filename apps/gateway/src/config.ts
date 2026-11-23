import { usdToMicros } from '@vigas/core';
import {
  SEVENAPI_DEFAULT_BASE_URL,
  SEVENAPI_PROVIDER_SLUG,
  SEVENAPI_PUBLIC_LABEL,
  YOUCOM_DEFAULT_BASE_URL,
  YOUCOM_PROVIDER_SLUG,
  YOUCOM_PUBLIC_LABEL,
} from '@vigas/core/seed';
import { parseKeyPoolEnv, parseKeyRotationStrategy, type KeyRotationStrategy, type PoolKeySpec } from './providers/key-pool';

export type ProviderKind = 'openai' | 'anthropic' | 'youcom';

export interface ProviderConfig {
  slug: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Primary key (always equals `apiKeys[0]?.key ?? null` for backward compatibility). */
  apiKey: string | null;
  /** Full pool of keys configured for this provider (e.g., 10 × $100 keys). */
  apiKeys: PoolKeySpec[];
  /** Rotation mode across `apiKeys`: `round_robin` | `random` | `sequential` | `least_used`. */
  keyStrategy: KeyRotationStrategy;
  /** When true, never expose `slug` or upstream host to customers (uses `publicLabel` instead). */
  hidden?: boolean;
  /** Masked label returned to callers when `hidden` or `hideUpstreamProviders` is active. */
  publicLabel?: string;
  /** Allow fallback to MockAdapter in local dev/tests when no API key is configured. Default true for built-in official labs, false for custom relay pools. */
  allowMock?: boolean;
}

export interface GatewayConfig {
  port: number;
  databaseUrl: string;
  internalServiceToken: string | null;
  rateLimitRpm: number;
  /** Serve models whose provider has no API key with the mock provider (dev and tests only). */
  mockProviders: boolean;
  /** Mask all upstream provider slugs in response headers, JSON bodies, and error strings. */
  hideUpstreamProviders: boolean;
  /**
   * When non-empty, accounts that have NEVER made a real deposit (`lifetimeTopupMicros === 0`)
   * can only spend free/promo welcome credit on models matching one of these prefixes (e.g. `['you/']`)
   * or $0 free models. Prevents multi-account abuse against paid upstream pools.
   */
  promoOnlyModelPrefixes: string[];
  providers: Record<string, ProviderConfig>;
  /** How long to wait for the first token before trying the next provider. */
  firstByteTimeoutMs: number;
  requestTimeoutMs: number;
  defaultMaxTokens: number;
}

interface BuiltinProviderSpec {
  slug: string;
  kind: ProviderKind;
  baseUrl: string;
  hidden?: boolean;
  publicLabel?: string;
  allowMock?: boolean;
  defaultStrategy?: KeyRotationStrategy;
}

/** Known upstreams. Every base URL can be overridden with `<SLUG>_BASE_URL`. */
const PROVIDERS: BuiltinProviderSpec[] = [
  { slug: 'openai', kind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { slug: 'anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { slug: 'google', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { slug: 'deepseek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { slug: 'moonshot', kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1' },
  { slug: 'nvidia', kind: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1' },
  { slug: 'together', kind: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  { slug: 'xiaomi', kind: 'openai', baseUrl: '' },
  { slug: 'xai', kind: 'openai', baseUrl: 'https://api.x.ai/v1' },
  { slug: 'zai', kind: 'openai', baseUrl: 'https://api.z.ai/api/paas/v4' },
  { slug: 'alibaba', kind: 'openai', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
  // Upstream relay pool #1: SevenAPI (`https://7api.st`, Anthropic Messages protocol).
  // Activated strictly when `SEVENAPI_API_KEY` or `SEVENAPI_API_KEYS` is provided; masked from customers.
  {
    slug: SEVENAPI_PROVIDER_SLUG,
    kind: 'anthropic',
    baseUrl: SEVENAPI_DEFAULT_BASE_URL,
    hidden: true,
    publicLabel: SEVENAPI_PUBLIC_LABEL,
    allowMock: false,
    defaultStrategy: 'round_robin',
  },
  // Upstream pool #2: You.com Agents API (`https://api.you.com/v1/agents/runs`).
  // Designed for multi-key pooling (e.g. 10 × $100 keys) via `YOU_API_KEYS` + `YOU_KEY_STRATEGY`.
  {
    slug: YOUCOM_PROVIDER_SLUG,
    kind: 'youcom',
    baseUrl: YOUCOM_DEFAULT_BASE_URL,
    hidden: true,
    publicLabel: YOUCOM_PUBLIC_LABEL,
    allowMock: false,
    defaultStrategy: 'round_robin',
  },
];

const cleanUrl = (url: string) => url.trim().replace(/\/+$/, '');

function parseProviderKind(raw: unknown): ProviderKind {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'anthropic') return 'anthropic';
  if (s === 'youcom' || s === 'you') return 'youcom';
  return 'openai';
}

interface DynamicKeyObject {
  key?: unknown;
  label?: unknown;
  budgetUsd?: unknown;
}

interface DynamicProviderInput {
  slug?: unknown;
  kind?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  apiKeys?: unknown;
  keyStrategy?: unknown;
  keyBudgetUsd?: unknown;
  hidden?: unknown;
  publicLabel?: unknown;
}

function parseDynamicKeys(item: DynamicProviderInput, slug: string): PoolKeySpec[] {
  const defaultBudgetUsd = typeof item.keyBudgetUsd === 'number' && Number.isFinite(item.keyBudgetUsd) && item.keyBudgetUsd > 0 ? item.keyBudgetUsd : null;
  const defaultBudgetMicros = defaultBudgetUsd !== null ? usdToMicros(defaultBudgetUsd) : null;
  const seen = new Set<string>();
  const out: PoolKeySpec[] = [];

  const push = (key: string, label?: string, budgetUsd?: number | null) => {
    const clean = key.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    const budgetMicros =
      typeof budgetUsd === 'number' && Number.isFinite(budgetUsd) && budgetUsd > 0 ? usdToMicros(budgetUsd) : defaultBudgetMicros;
    out.push({
      key: clean,
      label: label?.trim() || `${slug}-${String(out.length + 1).padStart(2, '0')}`,
      budgetMicros,
    });
  };

  if (Array.isArray(item.apiKeys)) {
    for (const entry of item.apiKeys as Array<string | DynamicKeyObject>) {
      if (typeof entry === 'string') {
        push(entry);
      } else if (entry && typeof entry === 'object' && typeof entry.key === 'string') {
        push(
          entry.key,
          typeof entry.label === 'string' ? entry.label : undefined,
          typeof entry.budgetUsd === 'number' ? entry.budgetUsd : undefined,
        );
      }
    }
  } else if (typeof item.apiKeys === 'string') {
    for (const part of item.apiKeys.split(/[\n,;]+/)) push(part);
  }
  if (typeof item.apiKey === 'string') push(item.apiKey);
  return out;
}

/**
 * Loads additional dynamic providers (for running 10–20+ upstream pools) from:
 * 1. `UPSTREAM_PROVIDERS` JSON array:
 *    `[{"slug":"pool2","kind":"anthropic","baseUrl":"https://...","apiKeys":["k1","k2"],"keyStrategy":"random","keyBudgetUsd":100}]`
 * 2. `PROVIDER_<NAME>_API_KEY` or `PROVIDER_<NAME>_API_KEYS` + `PROVIDER_<NAME>_BASE_URL`
 *    + optional `PROVIDER_<NAME>_KIND` (`openai`|`anthropic`|`youcom`),
 *    `PROVIDER_<NAME>_KEY_STRATEGY` (`round_robin`|`random`|`sequential`|`least_used`),
 *    `PROVIDER_<NAME>_KEY_BUDGET_USD`
 */
function loadDynamicProviders(env: NodeJS.ProcessEnv, target: Record<string, ProviderConfig>): void {
  const rawJson = (env.UPSTREAM_PROVIDERS ?? '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed as DynamicProviderInput[]) {
          const slug = typeof item?.slug === 'string' ? item.slug.trim().toLowerCase() : '';
          const baseUrl = typeof item?.baseUrl === 'string' ? cleanUrl(item.baseUrl) : '';
          if (!slug || !/^[a-z0-9_-]{2,40}$/.test(slug) || !baseUrl) continue;
          const apiKeys = parseDynamicKeys(item, slug);
          target[slug] = {
            slug,
            kind: parseProviderKind(item.kind),
            baseUrl,
            apiKey: apiKeys[0]?.key ?? null,
            apiKeys,
            keyStrategy: parseKeyRotationStrategy(item.keyStrategy, 'round_robin'),
            hidden: item.hidden !== false,
            publicLabel: typeof item.publicLabel === 'string' && item.publicLabel.trim() ? item.publicLabel.trim() : SEVENAPI_PUBLIC_LABEL,
            allowMock: false,
          };
        }
      }
    } catch {
      console.warn('[gateway] Ignoring malformed UPSTREAM_PROVIDERS JSON');
    }
  }

  const dynamicNames = new Set<string>();
  for (const k of Object.keys(env)) {
    const m = /^PROVIDER_([A-Z0-9_]+)_(?:API_KEY|API_KEYS)$/.exec(k);
    if (m?.[1]) dynamicNames.add(m[1]);
  }

  for (const name of dynamicNames) {
    const prefix = `PROVIDER_${name}`;
    const slug = name.toLowerCase();
    const baseUrl = cleanUrl(env[`${prefix}_BASE_URL`] ?? '');
    if (!baseUrl) continue;
    const apiKeys = parseKeyPoolEnv({
      keysRaw: env[`${prefix}_API_KEYS`],
      singleKey: env[`${prefix}_API_KEY`],
      budgetUsdRaw: env[`${prefix}_KEY_BUDGET_USD`],
      labelPrefix: slug,
    });
    if (apiKeys.length === 0) continue;
    target[slug] = {
      slug,
      kind: parseProviderKind(env[`${prefix}_KIND`]),
      baseUrl,
      apiKey: apiKeys[0]?.key ?? null,
      apiKeys,
      keyStrategy: parseKeyRotationStrategy(env[`${prefix}_KEY_STRATEGY`], 'round_robin'),
      hidden: env[`${prefix}_HIDDEN`] !== 'false',
      publicLabel: env[`${prefix}_PUBLIC_LABEL`]?.trim() || SEVENAPI_PUBLIC_LABEL,
      allowMock: false,
    };
  }
}

function parsePromoPrefixes(env: NodeJS.ProcessEnv, isProd: boolean): string[] {
  const raw = env.PROMO_ONLY_MODEL_PREFIXES;
  if (raw === undefined) return isProd ? ['you/'] : [];
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'none' || trimmed === '*' || trimmed === 'all') return [];
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function publicProviderLabel(config: Pick<GatewayConfig, 'hideUpstreamProviders' | 'providers'>, slug: string): string {
  const p = config.providers[slug];
  if (p?.hidden || config.hideUpstreamProviders) return p?.publicLabel || SEVENAPI_PUBLIC_LABEL;
  return slug;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const providers: Record<string, ProviderConfig> = {};
  for (const p of PROVIDERS) {
    const up = p.slug.toUpperCase();
    const aliasPrefix = p.slug === 'google' ? 'GEMINI' : null;
    const keysRaw = [env[`${up}_API_KEYS`], aliasPrefix ? env[`${aliasPrefix}_API_KEYS`] : undefined].filter(Boolean).join(',');
    const singleKey = env[`${up}_API_KEY`] || (aliasPrefix ? env[`${aliasPrefix}_API_KEY`] : undefined);
    const budgetUsdRaw = env[`${up}_KEY_BUDGET_USD`] || (aliasPrefix ? env[`${aliasPrefix}_KEY_BUDGET_USD`] : undefined);
    const strategyRaw = env[`${up}_KEY_STRATEGY`] || (aliasPrefix ? env[`${aliasPrefix}_KEY_STRATEGY`] : undefined);
    const apiKeys = parseKeyPoolEnv({
      keysRaw: keysRaw || undefined,
      singleKey,
      budgetUsdRaw,
      labelPrefix: p.slug,
    });
    providers[p.slug] = {
      slug: p.slug,
      kind: p.kind,
      baseUrl: cleanUrl(env[`${up}_BASE_URL`] || (aliasPrefix ? env[`${aliasPrefix}_BASE_URL`] : '') || p.baseUrl),
      apiKey: apiKeys[0]?.key ?? null,
      apiKeys,
      keyStrategy: parseKeyRotationStrategy(strategyRaw, p.defaultStrategy ?? 'round_robin'),
      hidden: p.hidden ?? false,
      publicLabel: p.publicLabel ?? SEVENAPI_PUBLIC_LABEL,
      allowMock: p.allowMock ?? true,
    };
  }
  loadDynamicProviders(env, providers);

  const isProd = env.NODE_ENV === 'production';
  return {
    port: Number(env.GATEWAY_PORT ?? env.PORT ?? 8787),
    databaseUrl: env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas',
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN && env.INTERNAL_SERVICE_TOKEN.length >= 16 ? env.INTERNAL_SERVICE_TOKEN : null,
    rateLimitRpm: Number(env.RATE_LIMIT_RPM ?? 120),
    mockProviders: !isProd && env.MOCK_PROVIDERS !== 'false',
    hideUpstreamProviders: env.HIDE_UPSTREAM_PROVIDERS ? env.HIDE_UPSTREAM_PROVIDERS === 'true' : isProd,
    promoOnlyModelPrefixes: parsePromoPrefixes(env, isProd),
    providers,
    firstByteTimeoutMs: Number(env.FIRST_BYTE_TIMEOUT_MS ?? 90_000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 300_000),
    defaultMaxTokens: Number(env.DEFAULT_MAX_TOKENS ?? 4096),
  };
}
