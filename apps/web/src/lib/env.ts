/**
 * Public origin of the website, without a trailing slash. Inlined at build time. On Vercel it falls
 * back to the project's production domain when NEXT_PUBLIC_SITE_URL isn't set.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/+$/, '');

export const SITE_NAME = 'Vigas';

/** The public API base URL shown in docs and quickstarts. */
export const API_BASE_URL = 'https://api.vigas.ai/v1';

export const RETROBUILD_URL = 'https://retrobuild.space/';

const int = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Server-only settings, read at request time so they can change without a rebuild. */
export function serverEnv() {
  return {
    gatewayUrl: (process.env.GATEWAY_URL || 'http://localhost:8787').replace(/\/+$/, ''),
    internalToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
    topupFeeBps: int(process.env.TOPUP_FEE_BPS, 500),
    paymentProvider: process.env.PAYMENT_PROVIDER ?? '',
    arenaDailyLimit: int(process.env.ARENA_DAILY_LIMIT, 30),
    arenaBillingAccountId: process.env.ARENA_BILLING_ACCOUNT_ID || null,
    production: process.env.NODE_ENV === 'production',
  };
}

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
