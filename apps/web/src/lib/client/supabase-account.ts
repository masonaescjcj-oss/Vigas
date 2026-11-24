'use client';

import type { ApiKeySummary, CreatedApiKey, WalletResponse } from '@vigas/core';
import { callFunction, getSupabase } from './supabase';

export interface SupabaseUsageSummary {
  tier: string;
  tokensUsed: number;
  planLimitTokens: number;
  remainingTokens: number;
  chatUsed: number | null;
  chatLimit: number | null;
  buildUsed: number | null;
  buildLimit: number | null;
}

export interface SupabaseAccountState {
  wallet: WalletResponse;
  rpcReady: boolean;
  usage: SupabaseUsageSummary | null;
}

interface RawVigasAccount {
  wallet?: {
    balance_micros?: number;
    lifetime_topup_micros?: number;
  };
  keys?: Array<{
    id: string;
    name: string;
    prefix: string;
    monthly_limit_micros: number | null;
    spent_month_micros: number;
    last_used_at: string | null;
    created_at: string;
  }>;
  week?: Array<{
    day: string;
    cost_micros: number;
  }>;
}

interface RawUsageCheck {
  tier?: string;
  remaining_tokens?: number;
  usage?: {
    tokens_used?: number;
    plan_limit_tokens?: number;
  };
  quota?: {
    chat?: { used?: number; limit?: number | null };
    build?: { used?: number; limit?: number | null };
  } | null;
}

/** Builds a clean 7-day UTC date spine so the dashboard chart always renders cleanly. */
export function emptyWeekDays(): WalletResponse['week'] {
  const days: WalletResponse['week'] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push({ date: d.toISOString().slice(0, 10), costMicros: 0 });
  }
  return days;
}

export function emptyWallet(feeBps = 500): WalletResponse {
  return {
    balanceMicros: 0,
    lifetimeTopupMicros: 0,
    feeBps,
    week: emptyWeekDays(),
    bySource: [],
    keys: [],
  };
}

function mapKeys(raw: RawVigasAccount['keys']): ApiKeySummary[] {
  return (raw ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    display: `${k.prefix}…`,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    monthlyLimitMicros: k.monthly_limit_micros ?? null,
    spentThisMonthMicros: Number(k.spent_month_micros ?? 0),
  }));
}

export async function fetchSupabaseUsage(): Promise<SupabaseUsageSummary | null> {
  try {
    const data = await callFunction<RawUsageCheck>('usage-check');
    return {
      tier: data.tier || 'free',
      tokensUsed: Number(data.usage?.tokens_used ?? 0),
      planLimitTokens: Number(data.usage?.plan_limit_tokens ?? 0),
      remainingTokens: Number(data.remaining_tokens ?? 0),
      chatUsed: data.quota?.chat?.used ?? null,
      chatLimit: data.quota?.chat?.limit ?? null,
      buildUsed: data.quota?.build?.used ?? null,
      buildLimit: data.quota?.build?.limit ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchWelcomePromoWallet(): Promise<WalletResponse | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/app/welcome-wallet', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as Partial<WalletResponse> | null;
    if (!body || typeof body.balanceMicros !== 'number') return null;
    return {
      balanceMicros: body.balanceMicros,
      lifetimeTopupMicros: typeof body.lifetimeTopupMicros === 'number' ? body.lifetimeTopupMicros : 5_000_000,
      feeBps: typeof body.feeBps === 'number' ? body.feeBps : 500,
      week: Array.isArray(body.week) && body.week.length > 0 ? body.week : emptyWeekDays(),
      bySource: Array.isArray(body.bySource) ? body.bySource : [],
      keys: Array.isArray(body.keys) ? body.keys : [],
    };
  } catch {
    return null;
  }
}

export async function fetchSupabaseAccount(): Promise<SupabaseAccountState> {
  const supabase = getSupabase();
  const [rpcRes, usage] = await Promise.all([
    supabase.rpc('vigas_account'),
    fetchSupabaseUsage(),
  ]);

  if (rpcRes.error || !rpcRes.data) {
    const promoWallet = await fetchWelcomePromoWallet();
    return {
      wallet: promoWallet ?? emptyWallet(),
      rpcReady: false,
      usage,
    };
  }

  const raw = rpcRes.data as RawVigasAccount;
  const week =
    Array.isArray(raw.week) && raw.week.length > 0
      ? raw.week.map((w) => ({
          date: String(w.day).slice(0, 10),
          costMicros: Number(w.cost_micros ?? 0),
        }))
      : emptyWeekDays();

  const weekSpend = week.reduce((sum, d) => sum + d.costMicros, 0);

  return {
    rpcReady: true,
    usage,
    wallet: {
      balanceMicros: Number(raw.wallet?.balance_micros ?? 0),
      lifetimeTopupMicros: Number(raw.wallet?.lifetime_topup_micros ?? 0),
      feeBps: 500,
      week,
      bySource: weekSpend > 0 ? [{ source: 'api', costMicros: weekSpend }] : [],
      keys: mapKeys(raw.keys),
    },
  };
}

export async function createSupabaseApiKey(
  name: string,
  monthlyLimitMicros: number | null,
): Promise<CreatedApiKey> {
  const { data, error } = await getSupabase().rpc('vigas_create_api_key', {
    p_name: name,
    p_monthly_limit_micros: monthlyLimitMicros,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Could not create API key on backend.');
  }
  const row = data as {
    id: string;
    name: string;
    prefix: string;
    key: string;
    monthly_limit_micros: number | null;
    created_at: string;
  };
  return {
    id: row.id,
    name: row.name,
    display: `${row.prefix}…`,
    key: row.key,
    createdAt: row.created_at,
    lastUsedAt: null,
    monthlyLimitMicros: row.monthly_limit_micros ?? null,
    spentThisMonthMicros: 0,
  };
}

export async function revokeSupabaseApiKey(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('vigas_revoke_api_key', { p_id: id });
  if (error) {
    throw new Error(error.message || 'Could not revoke API key.');
  }
}

export type SupabaseCreditPackId = 'credits_10' | 'credits_25' | 'credits_50' | 'credits_100';

export const SUPABASE_CREDIT_PACKS: Array<{ id: SupabaseCreditPackId; usd: number }> = [
  { id: 'credits_10', usd: 10 },
  { id: 'credits_25', usd: 25 },
  { id: 'credits_50', usd: 50 },
  { id: 'credits_100', usd: 100 },
];

export async function startSupabaseCreditsCheckout(packId: SupabaseCreditPackId): Promise<{ url: string; reference: string }> {
  return callFunction<{ url: string; reference: string }>('checkout-create', { planId: packId });
}
