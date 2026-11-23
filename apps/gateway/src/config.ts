import { SEVENAPI_DEFAULT_BASE_URL, SEVENAPI_PROVIDER_SLUG, SEVENAPI_PUBLIC_LABEL } from '@vigas/core/seed';

export type ProviderKind = 'openai' | 'anthropic';

export interface ProviderConfig {
  slug: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string | null;
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
  // Activated strictly when `SEVENAPI_API_KEY` is provided in server env; masked from customers.
  {
    slug: SEVENAPI_PROVIDER_SLUG,
    kind: 'anthropic',
    baseUrl: SEVENAPI_DEFAULT_BASE_URL,
    hidden: true,
    publicLabel: SEVENAPI_PUBLIC_LABEL,
    allowMock: false,
  },
];

const cleanUrl = (url: string) => url.trim().replace(/\/+$/, '');

interface DynamicProviderInput {
  slug?: unknown;
  kind?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  hidden?: unknown;
  publicLabel?: unknown;
}

/**
 * Loads additional dynamic providers (for running 10–20+ upstream pools) from:
 * 1. `UPSTREAM_PROVIDERS` JSON array: `[{"slug":"pool2","kind":"anthropic","baseUrl":"https://...","apiKey":"..."}]`
 * 2. `PROVIDER_<NAME>_API_KEY` + `PROVIDER_<NAME>_BASE_URL` + optional `PROVIDER_<NAME>_KIND` (`openai`|`anthropic`)
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
          const apiKey = typeof item?.apiKey === 'string' && item.apiKey.trim() ? item.apiKey.trim() : null;
          const kind: ProviderKind = item?.kind === 'anthropic' ? 'anthropic' : 'openai';
          if (!slug || !/^[a-z0-9_-]{2,40}$/.test(slug) || !baseUrl) continue;
          target[slug] = {
            slug,
            kind,
            baseUrl,
            apiKey,
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

  for (const [k, v] of Object.entries(env)) {
    const m = /^PROVIDER_([A-Z0-9_]+)_API_KEY$/.exec(k);
    if (!m?.[1] || !v?.trim()) continue;
    const prefix = `PROVIDER_${m[1]}`;
    const slug = m[1].toLowerCase();
    const baseUrl = cleanUrl(env[`${prefix}_BASE_URL`] ?? '');
    if (!baseUrl) continue;
    const kind: ProviderKind = env[`${prefix}_KIND`]?.toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';
    target[slug] = {
      slug,
      kind,
      baseUrl,
      apiKey: v.trim(),
      hidden: env[`${prefix}_HIDDEN`] !== 'false',
      publicLabel: env[`${prefix}_PUBLIC_LABEL`]?.trim() || SEVENAPI_PUBLIC_LABEL,
      allowMock: false,
    };
  }
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
    providers[p.slug] = {
      slug: p.slug,
      kind: p.kind,
      baseUrl: cleanUrl(env[`${up}_BASE_URL`] || p.baseUrl),
      apiKey: env[`${up}_API_KEY`]?.trim() || null,
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
    providers,
    firstByteTimeoutMs: Number(env.FIRST_BYTE_TIMEOUT_MS ?? 90_000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 300_000),
    defaultMaxTokens: Number(env.DEFAULT_MAX_TOKENS ?? 4096),
  };
}
