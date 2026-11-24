import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { AuthResponse } from '@vigas/core';
import { createSession, findOrCreateExternalUser, getDb } from '@vigas/db';
import { extractDbError, isAdminEmail, setAdminBridgeCookies } from '@/lib/admin';
import { setSessionCookies, toPublicUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { apiError, clientIp, originMismatch, rateLimit, readJson } from '@/lib/http';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';

const exchangeSchema = z.object({
  accessToken: z.string().min(16, 'Missing access token.').max(8192),
});

interface SupabaseUserPayload {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: { full_name?: string; name?: string };
}

/**
 * Exchanges a verified Supabase Auth JWT (created by RetroCode /chat, Google OAuth, or unified
 * email/OTP login) for a first-party Vigas session cookie + bearer token backed by `@vigas/db`.
 * Also sets signed admin bridge cookies for verified admin emails even if Postgres is temporarily down.
 */
export async function POST(req: Request) {
  const bad = originMismatch(req);
  if (bad) return bad;
  const limited = rateLimit(`exchange:${clientIp(req)}`, 30, 60_000);
  if (limited) return limited;

  const body = await readJson(req, exchangeSchema);
  if (!body.ok) return body.res;

  const env = serverEnv();
  let supaUser: SupabaseUserPayload | null = null;
  try {
    const upstream = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${body.data.accessToken}`,
        apikey: env.supabaseAnonKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!upstream.ok) {
      return apiError(401, 'invalid_token', 'Your sign-in session could not be verified. Sign in again.');
    }
    supaUser = (await upstream.json()) as SupabaseUserPayload;
  } catch {
    return apiError(502, 'auth_upstream_unavailable', 'Could not verify your session right now. Please try again.');
  }

  const email = supaUser?.email?.trim().toLowerCase();
  const verified = Boolean(supaUser?.email_confirmed_at || supaUser?.confirmed_at || supaUser?.app_metadata?.provider === 'google');
  if (!email || !verified) {
    return apiError(403, 'email_unverified', 'Confirm your email address before continuing.');
  }

  const name = supaUser?.user_metadata?.full_name || supaUser?.user_metadata?.name || null;
  const adminIdentity = isAdminEmail(email)
    ? { id: supaUser?.id ?? `supa:${email}`, email, name }
    : null;

  if (PREVIEW_MODE) {
    const res = apiError(503, 'preview_mode', PREVIEW_MESSAGE);
    if (adminIdentity) setAdminBridgeCookies(res, adminIdentity);
    return res;
  }

  try {
    const db = getDb();
    const user = await findOrCreateExternalUser(db, {
      email,
      name,
      welcomeBonusMicros: env.signupBonusMicros,
      welcomeReference: 'welcome:youcom',
    });
    const token = await createSession(db, user.id, req.headers.get('user-agent'));

    const payload: AuthResponse = { user: toPublicUser(user), token };
    const res = NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
    setSessionCookies(res, token);
    if (adminIdentity) setAdminBridgeCookies(res, { id: user.id, email: user.email, name: user.name });
    return res;
  } catch (err) {
    const dbErr = extractDbError(err);
    const res = apiError(
      503,
      dbErr?.code ?? 'db_unavailable',
      dbErr?.code === '28P01'
        ? 'Postgres password authentication failed (28P01). Continuing on Supabase session.'
        : dbErr?.message ?? 'Database is temporarily unavailable.',
    );
    if (adminIdentity) setAdminBridgeCookies(res, adminIdentity);
    return res;
  }
}
