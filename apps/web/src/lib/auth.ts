import { cookies } from 'next/headers';
import { connection, type NextResponse } from 'next/server';
import type { PublicUser } from '@vigas/core';
import { getDb, getSessionUser, SESSION_TTL_MS, type SessionUser } from '@vigas/db';
import { serverEnv } from './env';
import { PREVIEW_MODE } from './preview';

/** httpOnly session cookie holding the session token. */
export const SESSION_COOKIE = 'vigas_session';
/**
 * Readable, secret-free marker ("1") so static pages can show signed-in navigation without a
 * request. It never grants access: every API call re-checks the session cookie or bearer token.
 */
export const SIGNED_IN_COOKIE = 'vigas_signed_in';

export type AuthVia = 'cookie' | 'bearer';

export interface RequestAuth {
  user: SessionUser;
  via: AuthVia;
  token: string;
}

/** Bearer token (Android app) takes precedence over the session cookie (website). */
export function readToken(req: Request): { token: string; via: AuthVia } | null {
  const header = req.headers.get('authorization');
  if (header) {
    const m = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (m?.[1]) return { token: m[1].trim(), via: 'bearer' };
  }
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      if (part.slice(0, i).trim() === SESSION_COOKIE) {
        const value = decodeURIComponent(part.slice(i + 1).trim());
        if (value) return { token: value, via: 'cookie' };
      }
    }
  }
  return null;
}

export async function getRequestAuth(req: Request): Promise<RequestAuth | null> {
  if (PREVIEW_MODE) return null;
  const t = readToken(req);
  if (!t || t.token.length > 200) return null;
  const user = await getSessionUser(getDb(), t.token);
  return user ? { user, via: t.via, token: t.token } : null;
}

/** For request-time Server Components. Must be rendered inside <Suspense>. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (PREVIEW_MODE) return null;
  if (!token || token.length > 200) return null;
  // The session lookup compares expiry with the current time; tell Next this runs per request,
  // otherwise it reports `new Date()` during prerendering.
  await connection();
  return getSessionUser(getDb(), token);
}

export const toPublicUser = (u: Pick<SessionUser, 'id' | 'email' | 'name'>): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
});

const cookieBase = () => ({
  sameSite: 'lax' as const,
  path: '/',
  secure: serverEnv().production,
});

export function setSessionCookies(res: NextResponse, token: string): void {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.cookies.set(SESSION_COOKIE, token, { ...cookieBase(), httpOnly: true, maxAge });
  res.cookies.set(SIGNED_IN_COOKIE, '1', { ...cookieBase(), httpOnly: false, maxAge });
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieBase(), httpOnly: true, maxAge: 0 });
  res.cookies.set(SIGNED_IN_COOKIE, '', { ...cookieBase(), httpOnly: false, maxAge: 0 });
}
