/**
 * Public origin of the website, without a trailing slash. Inlined at build time. On Vercel it falls
 * back to the project's production domain when NEXT_PUBLIC_SITE_URL isn't set.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://vigas.app')
).replace(/\/+$/, '');

export const SITE_NAME = 'Vigas';

/** The public API base URL shown in docs and quickstarts. */
export const API_BASE_URL = 'https://api.vigas.ai/v1';

const int = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Server-only settings, read at request time so they can change without a rebuild. */
export function serverEnv() {
  const avexpayApiKey = (process.env.AVEXPAY_API_KEY ?? '').trim();
  const inferredMode =
    process.env.AVEXPAY_MODE === 'test' || avexpayApiKey.startsWith('ak_test_') ? ('test' as const) : ('live' as const);
  return {
    gatewayUrl: (process.env.GATEWAY_URL || 'http://localhost:8787').replace(/\/+$/, ''),
    internalToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
    topupFeeBps: int(process.env.TOPUP_FEE_BPS, 500),
    paymentProvider: (process.env.PAYMENT_PROVIDER ?? '').trim(),
    avexpayApiKey,
    avexpayOrgId: (process.env.AVEXPAY_ORG_ID ?? '').trim(),
    avexpayWebhookSecret: (process.env.AVEXPAY_WEBHOOK_SECRET ?? '').trim(),
    avexpayBaseUrl: (process.env.AVEXPAY_BASE_URL || 'https://api.avexpay.net/v1').replace(/\/+$/, ''),
    avexpayMode: inferredMode,
    supabaseUrl: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jasgepmskcsyvqoesocc.supabase.co').replace(
      /\/+$/,
      '',
    ),
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9',
    production: process.env.NODE_ENV === 'production',
  };
}

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
