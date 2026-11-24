import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';
import type { WalletResponse } from '@vigas/core';
import { readToken } from './auth';
import { serverEnv } from './env';

export const PROMO_WALLET_COOKIE = 'vigas_promo_wallet';
const PROMO_WALLET_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

export interface VerifiedWebUser {
  id: string;
  email: string;
  name: string | null;
}

export interface PromoWalletState {
  uid: string;
  /** Remaining welcome promo credit in USD micros ($5.00 = 5_000_000). */
  bal: number;
  /** Total promo credit spent in USD micros. */
  spent: number;
  /** Daily spend map (`YYYY-MM-DD` -> micros, trimmed to last 14 days). */
  days: Record<string, number>;
}

function promoWalletSecret(): Buffer | null {
  const env = serverEnv();
  const raw =
    env.internalToken ||
    (process.env.UPSTREAM_KEYS_SECRET ?? '').trim() ||
    (!env.production ? `dev:${env.supabaseAnonKey}` : '');
  if (!raw) return null;
  return createHash('sha256').update(`vigas-promo-wallet:v1:${raw}`).digest();
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      const value = decodeURIComponent(part.slice(i + 1).trim());
      if (value) return value;
    }
  }
  return null;
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function emptyWeekDays(): WalletResponse['week'] {
  const out: WalletResponse['week'] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push({ date: d.toISOString().slice(0, 10), costMicros: 0 });
  }
  return out;
}

/** Verifies a Supabase access token against Supabase Auth `/auth/v1/user`. */
export async function verifySupabaseBearerUser(req: Request): Promise<VerifiedWebUser | null> {
  const tokenInfo = readToken(req);
  if (!tokenInfo || tokenInfo.via !== 'bearer') return null;
  const env = serverEnv();
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenInfo.token}`,
        apikey: env.supabaseAnonKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null;
    if (!data?.id || !data?.email) return null;
    const name =
      (typeof data.user_metadata?.full_name === 'string' && data.user_metadata.full_name.trim()) ||
      (typeof data.user_metadata?.name === 'string' && data.user_metadata.name.trim()) ||
      null;
    return {
      id: data.id,
      email: data.email.trim().toLowerCase(),
      name,
    };
  } catch {
    return null;
  }
}

export function initialPromoWallet(userId: string): PromoWalletState {
  const initialMicros = Math.max(0, serverEnv().signupBonusMicros);
  return {
    uid: userId,
    bal: initialMicros,
    spent: 0,
    days: {},
  };
}

export function readPromoWalletFromRequest(req: Request, userId: string): PromoWalletState {
  const secret = promoWalletSecret();
  const raw = readCookie(req.headers.get('cookie'), PROMO_WALLET_COOKIE);
  if (!secret || !raw) return initialPromoWallet(userId);

  const dot = raw.indexOf('.');
  if (dot <= 0 || dot >= raw.length - 1) return initialPromoWallet(userId);

  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return initialPromoWallet(userId);
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<PromoWalletState>;
    if (parsed.uid !== userId || typeof parsed.bal !== 'number' || !Number.isFinite(parsed.bal)) {
      return initialPromoWallet(userId);
    }
    const cleanDays: Record<string, number> = {};
    if (parsed.days && typeof parsed.days === 'object') {
      for (const [k, v] of Object.entries(parsed.days)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          cleanDays[k] = Math.round(v);
        }
      }
    }
    return {
      uid: userId,
      bal: Math.max(0, Math.round(parsed.bal)),
      spent: typeof parsed.spent === 'number' && Number.isFinite(parsed.spent) ? Math.max(0, Math.round(parsed.spent)) : 0,
      days: cleanDays,
    };
  } catch {
    return initialPromoWallet(userId);
  }
}

export function debitPromoWallet(state: PromoWalletState, costMicros: number): PromoWalletState {
  const charge = Math.max(0, Math.round(costMicros));
  if (charge <= 0) return state;
  const today = utcDay();
  const nextDays: Record<string, number> = { ...state.days, [today]: (state.days[today] ?? 0) + charge };
  // Keep only the 14 most recent UTC days so cookie size stays tiny.
  const sortedKeys = Object.keys(nextDays).sort().slice(-14);
  const trimmedDays: Record<string, number> = {};
  for (const k of sortedKeys) trimmedDays[k] = nextDays[k]!;
  return {
    uid: state.uid,
    bal: Math.max(0, state.bal - charge),
    spent: state.spent + charge,
    days: trimmedDays,
  };
}

export function setPromoWalletCookie(res: NextResponse, state: PromoWalletState): void {
  const secret = promoWalletSecret();
  if (!secret) return;
  const body = Buffer.from(JSON.stringify(state)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  res.cookies.set(PROMO_WALLET_COOKIE, `${body}.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: serverEnv().production,
    maxAge: PROMO_WALLET_TTL_SEC,
  });
}

export function promoStateToWalletResponse(state: PromoWalletState, feeBps = 500): WalletResponse {
  const week = emptyWeekDays().map((d) => ({
    date: d.date,
    costMicros: state.days[d.date] ?? 0,
  }));
  const weekSpend = week.reduce((sum, d) => sum + d.costMicros, 0);
  return {
    balanceMicros: state.bal,
    lifetimeTopupMicros: Math.max(0, serverEnv().signupBonusMicros),
    feeBps,
    week,
    bySource: weekSpend > 0 ? [{ source: 'chat', costMicros: weekSpend }] : [],
    keys: [],
  };
}
