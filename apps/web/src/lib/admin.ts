import { revalidateTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { AdminInputError, type SessionUser } from '@vigas/db';
import { getCurrentUser, readToken, type RequestAuth } from './auth';
import { serverEnv } from './env';
import { apiError, requireAuth } from './http';

const DEFAULT_ADMIN_EMAILS = ['ma.sonaescjcj@gmail.com'];

export function isAdminEmail(email: string): boolean {
  const target = email.trim().toLowerCase();
  if (DEFAULT_ADMIN_EMAILS.includes(target)) return true;
  const raw = (process.env.ADMIN_EMAILS ?? '').trim();
  if (!raw) return false;
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}

export function isAdminUser(user: Pick<SessionUser, 'role' | 'email'> | null | undefined): boolean {
  return Boolean(user && (user.role === 'admin' || isAdminEmail(user.email)));
}

/** Verifies a Supabase Auth access token server-side and checks whether its verified email is an admin. */
export async function verifySupabaseAdminToken(accessToken: string): Promise<{ id: string; email: string; name: string | null } | null> {
  if (!accessToken || accessToken.length < 16 || accessToken.length > 8192) return null;
  const env = serverEnv();
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.supabaseAnonKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      id?: string;
      email?: string;
      email_confirmed_at?: string | null;
      confirmed_at?: string | null;
      app_metadata?: { provider?: string };
      user_metadata?: { full_name?: string; name?: string };
    };
    const email = payload.email?.trim().toLowerCase();
    const verified = Boolean(payload.email_confirmed_at || payload.confirmed_at || payload.app_metadata?.provider === 'google');
    if (!email || !verified || !isAdminEmail(email)) return null;
    return {
      id: payload.id ?? `supa:${email}`,
      email,
      name: payload.user_metadata?.full_name || payload.user_metadata?.name || null,
    };
  } catch {
    return null;
  }
}

/**
 * Admin access. Non-admins get a plain 404 so the admin area doesn't advertise itself.
 * Granted when users.role === 'admin' OR email is listed in DEFAULT_ADMIN_EMAILS / `ADMIN_EMAILS`
 * (supports both first-party Postgres sessions and verified Supabase Auth bearer tokens).
 */
export async function requireAdmin(req: Request): Promise<RequestAuth | NextResponse> {
  const auth = await requireAuth(req);
  if (!(auth instanceof NextResponse)) {
    if (!isAdminUser(auth.user)) return apiError(404, 'not_found', 'Not found.');
    return auth;
  }
  const bearer = readToken(req);
  if (bearer?.via === 'bearer') {
    const supaAdmin = await verifySupabaseAdminToken(bearer.token);
    if (supaAdmin) {
      return {
        via: 'bearer',
        token: bearer.token,
        user: { ...supaAdmin, role: 'admin', accountId: '' },
      };
    }
  }
  return auth;
}

/** For request-time admin pages (inside <Suspense>). */
export async function getAdminUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) notFound();
  return user;
}

/** Makes edits visible right away on cached public pages. */
export function refreshContent(kind: 'news' | 'tools', slugs: Array<string | null | undefined>): void {
  revalidateTag(kind, { expire: 0 });
  for (const slug of slugs) {
    if (slug) revalidateTag(kind === 'news' ? `article:${slug}` : `tool:${slug}`, { expire: 0 });
  }
}

/** Turns validation errors from @vigas/db into a 400; rethrows anything else. */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminInputError) return apiError(400, 'invalid_input', err.message);
  throw err;
}
