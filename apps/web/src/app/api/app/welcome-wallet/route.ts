import { NextResponse } from 'next/server';
import { getDb, getWallet } from '@vigas/db';
import { getRequestAuth } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { apiError } from '@/lib/http';
import {
  promoStateToWalletResponse,
  readPromoWalletFromRequest,
  setPromoWalletCookie,
  verifySupabaseBearerUser,
} from '@/lib/welcome-wallet';

/**
 * Returns the authenticated user's wallet with the $5.00 welcome credit active.
 * Uses Postgres `vigas.accounts` when DATABASE_URL is reachable, and falls back seamlessly
 * to the HMAC-SHA256 signed httpOnly welcome promo wallet bound to the verified Supabase user.
 */
export async function GET(req: Request) {
  const env = serverEnv();

  // 1. First-party Postgres session when DB is healthy
  const pgAuth = await getRequestAuth(req).catch(() => null);
  if (pgAuth) {
    try {
      const wallet = await getWallet(getDb(), pgAuth.user.accountId, env.topupFeeBps);
      return NextResponse.json(
        { ...wallet, source: 'postgres', promoCreditMicros: env.signupBonusMicros },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    } catch {
      // Fall through to Supabase-verified welcome promo wallet
    }
  }

  // 2. Verified Supabase Bearer session
  const supaUser = await verifySupabaseBearerUser(req);
  if (!supaUser) {
    return apiError(401, 'unauthorized', 'Sign in to access your Vigas wallet.');
  }

  const state = readPromoWalletFromRequest(req, supaUser.id);
  const wallet = promoStateToWalletResponse(state, env.topupFeeBps);
  const res = NextResponse.json(
    { ...wallet, source: 'welcome_promo', promoCreditMicros: env.signupBonusMicros },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
  setPromoWalletCookie(res, state);
  return res;
}
