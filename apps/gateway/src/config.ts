export type ProviderKind = 'openai' | 'anthropic';

export interface ProviderConfig {
  slug: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string | null;
}

export interface GatewayConfig {
  port: number;
  databaseUrl: string;
  internalServiceToken: string | null;
  rateLimitRpm: number;
  /** Serve models whose provider has no API key with the mock provider (dev and tests only). */
  mockProviders: boolean;
  providers: Record<string, ProviderConfig>;
  /** How long to wait for the first token before trying the next provider. */
  firstByteTimeoutMs: number;
  requestTimeoutMs: number;
  defaultMaxTokens: number;
}

/** Known upstreams. Every base URL can be overridden with `<SLUG>_BASE_URL`. */
const PROVIDERS: Array<{ slug: string; kind: ProviderKind; baseUrl: string }> = [
  { slug: 'openai', kind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { slug: 'anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { slug: 'google', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { slug: 'deepseek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { slug: 'moonshot', kind: 'openai', baseUrl: 'https://api.moonshot.ai/v1' },
  { slug: 'nvidia', kind: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1' },
  { slug: 'together', kind: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  { slug: 'xiaomi', kind: 'openai', baseUrl: '' },
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const providers: Record<string, ProviderConfig> = {};
  for (const p of PROVIDERS) {
    const up = p.slug.toUpperCase();
    providers[p.slug] = {
      slug: p.slug,
      kind: p.kind,
      baseUrl: (env[`${up}_BASE_URL`] || p.baseUrl).replace(/\/+$/, ''),
      apiKey: env[`${up}_API_KEY`] || null,
    };
  }
  const isProd = env.NODE_ENV === 'production';
  return {
    port: Number(env.GATEWAY_PORT ?? env.PORT ?? 8787),
    databaseUrl: env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas',
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN && env.INTERNAL_SERVICE_TOKEN.length >= 16 ? env.INTERNAL_SERVICE_TOKEN : null,
    rateLimitRpm: Number(env.RATE_LIMIT_RPM ?? 120),
    mockProviders: !isProd && env.MOCK_PROVIDERS !== 'false',
    providers,
    firstByteTimeoutMs: Number(env.FIRST_BYTE_TIMEOUT_MS ?? 30_000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS ?? 300_000),
    defaultMaxTokens: Number(env.DEFAULT_MAX_TOKENS ?? 4096),
  };
}
