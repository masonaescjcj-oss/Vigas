import { normalizeAvexPayStatusField, type AvexPayNormalizedStatus } from '@vigas/core';
import { serverEnv } from './env';

export type ActivePaymentMode = 'avexpay' | 'test' | 'none';

export function activePaymentMode(env = serverEnv()): ActivePaymentMode {
  if (env.paymentProvider === 'avexpay') return env.avexpayApiKey ? 'avexpay' : 'none';
  if (env.avexpayApiKey && env.paymentProvider !== 'test') return 'avexpay';
  if (env.paymentProvider === 'test') return 'test';
  return 'none';
}

const orgCache = new Map<string, string>();

async function resolveAvexPayOrgId(): Promise<string> {
  const env = serverEnv();
  if (!env.avexpayApiKey) throw new Error('AVEXPAY_API_KEY is not configured.');
  if (env.avexpayOrgId) return env.avexpayOrgId;

  const cacheKey = `${env.avexpayBaseUrl}:${env.avexpayApiKey.slice(0, 16)}`;
  const cached = orgCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${env.avexpayBaseUrl}/organizations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.avexpayApiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AvexPay organizations lookup failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { data?: Array<{ id?: string }>; id?: string };
  const orgId = payload.data?.[0]?.id ?? payload.id;
  if (!orgId) {
    throw new Error('No AvexPay organization found for this API key.');
  }
  orgCache.set(cacheKey, orgId);
  return orgId;
}

export interface AvexPayCheckoutSession {
  sessionId: string;
  url: string;
}

export async function createAvexPayCheckout(input: {
  amountFiatMicros: number;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<AvexPayCheckoutSession> {
  const env = serverEnv();
  const orgId = await resolveAvexPayOrgId();

  const res = await fetch(`${env.avexpayBaseUrl}/organizations/${encodeURIComponent(orgId)}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.avexpayApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amountFiatMicros: input.amountFiatMicros,
      reference: input.reference,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AvexPay checkout refused (${res.status}): ${text.slice(0, 220)}`);
  }

  const raw = (await res.json()) as {
    id?: string;
    url?: string;
    checkoutUrl?: string;
    data?: { id?: string; url?: string; checkoutUrl?: string };
  };
  const body = raw.data ?? raw;
  const sessionId = String(body.id ?? '');
  const url = String(body.url ?? body.checkoutUrl ?? '');
  if (!sessionId || !url) {
    throw new Error('AvexPay returned an incomplete checkout session.');
  }
  return { sessionId, url };
}

export interface AvexPayCheckoutStatus {
  id: string;
  reference: string;
  status: string;
  normalizedStatus: AvexPayNormalizedStatus;
  settledMicros?: number;
}

export async function fetchAvexPayCheckout(sessionId: string): Promise<AvexPayCheckoutStatus | null> {
  const env = serverEnv();
  if (!env.avexpayApiKey || !sessionId) return null;
  const orgId = await resolveAvexPayOrgId();

  const res = await fetch(
    `${env.avexpayBaseUrl}/organizations/${encodeURIComponent(orgId)}/checkouts/${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.avexpayApiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) return null;
  const raw = (await res.json()) as {
    id?: string;
    status?: string;
    reference?: string;
    paidFiatMicros?: number;
    settledFiatMicros?: number;
    amountFiatMicros?: number;
    data?: {
      id?: string;
      status?: string;
      reference?: string;
      paidFiatMicros?: number;
      settledFiatMicros?: number;
      amountFiatMicros?: number;
    };
  };
  const body = raw.data ?? raw;
  const status = String(body.status ?? 'pending');
  const settled = body.settledFiatMicros ?? body.paidFiatMicros;
  return {
    id: String(body.id ?? sessionId),
    reference: String(body.reference ?? ''),
    status,
    normalizedStatus: normalizeAvexPayStatusField(status),
    ...(typeof settled === 'number' && Number.isFinite(settled) ? { settledMicros: Math.round(settled) } : {}),
  };
}
