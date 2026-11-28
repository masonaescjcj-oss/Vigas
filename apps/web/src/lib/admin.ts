import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection, NextResponse } from 'next/server';
import { AdminInputError, getDb, probeDb, type SessionUser } from '@vigas/db';
import { ADMIN_BRIDGE_COOKIE, ADMIN_HINT_COOKIE, getCurrentUser, readToken, type RequestAuth } from './auth';
import { serverEnv } from './env';
import { apiError, originMismatch, requireAuth } from './http';
import { PREVIEW_MODE } from './preview';

export const DEFAULT_ADMIN_EMAILS = ['ma.sonaescjcj@gmail.com'];
const ADMIN_BRIDGE_TTL_SEC = 60 * 60 * 12; // 12 hours

interface AdminBridgePayload {
  id: string;
  email: string;
  name: string | null;
  exp: number;
}

function matchesInternalToken(candidate: string): boolean {
  const expected = serverEnv().internalToken;
  if (!expected || expected.length < 24 || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

function adminBridgeSecret(): Buffer | null {
  const env = serverEnv();
  const raw = env.internalToken || (process.env.UPSTREAM_KEYS_SECRET ?? '').trim() || (!env.production ? `dev:${env.supabaseAnonKey}` : '');
  if (!raw) return null;
  return createHash('sha256').update(`vigas-admin-bridge:v1:${raw}`).digest();
}

export function createAdminBridgeToken(user: { id: string; email: string; name: string | null }): string | null {
  const secret = adminBridgeSecret();
  if (!secret || !isAdminEmail(user.email)) return null;
  const payload: AdminBridgePayload = {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    name: user.name ?? null,
    exp: Math.floor(Date.now() / 1000) + ADMIN_BRIDGE_TTL_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAdminBridgeToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const secret = adminBridgeSecret();
  if (!secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot >= token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<AdminBridgePayload>;
    if (!parsed.email || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!isAdminEmail(parsed.email)) return null;
    return {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : `supa:${parsed.email}`,
      email: parsed.email.trim().toLowerCase(),
      name: typeof parsed.name === 'string' ? parsed.name : null,
      role: 'admin',
      accountId: '',
    };
  } catch {
    return null;
  }
}

export function setAdminBridgeCookies(res: NextResponse, user: { id: string; email: string; name: string | null }): boolean {
  const token = createAdminBridgeToken(user);
  if (!token) return false;
  const base = {
    sameSite: 'lax' as const,
    path: '/',
    secure: serverEnv().production,
    maxAge: ADMIN_BRIDGE_TTL_SEC,
  };
  res.cookies.set(ADMIN_BRIDGE_COOKIE, token, { ...base, httpOnly: true });
  res.cookies.set(ADMIN_HINT_COOKIE, '1', { ...base, httpOnly: false });
  return true;
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
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

export interface AdminDbHealth {
  previewMode: boolean;
  connected: boolean;
  code?: string;
  message?: string;
}

const DB_PROBE_TTL_MS = 30_000;
let cachedDbProbe: { value: AdminDbHealth; expiresAt: number } | null = null;

/** Safe, non-throwing Postgres health probe for Admin pages and status endpoints (30s process cache). */
export async function probeAdminDb(force = false): Promise<AdminDbHealth> {
  if (PREVIEW_MODE) {
    return {
      previewMode: true,
      connected: false,
      code: 'preview_mode',
      message: 'DATABASE_URL is not configured.',
    };
  }
  const now = Date.now();
  if (!force && cachedDbProbe && cachedDbProbe.expiresAt > now) {
    return cachedDbProbe.value;
  }
  const res = await probeDb(getDb());
  const value: AdminDbHealth = res.ok
    ? { previewMode: false, connected: true }
    : {
        previewMode: false,
        connected: false,
        code: res.code,
        message: res.message,
      };
  cachedDbProbe = { value, expiresAt: now + (res.ok ? DB_PROBE_TTL_MS : 5_000) };
  return value;
}

/**
 * Admin access. Non-admins get a plain 404 so the admin area doesn't advertise itself.
 * Granted when users.role === 'admin' OR email is listed in DEFAULT_ADMIN_EMAILS / `ADMIN_EMAILS`
 * (supports first-party Postgres sessions, verified Supabase Auth bearer tokens, signed
 * `vigas_admin_bridge` cookies, and `INTERNAL_SERVICE_TOKEN`).
 */
export async function requireAdmin(req: Request): Promise<RequestAuth | NextResponse> {
  const bearer = readToken(req);
  if (bearer?.via === 'bearer' && matchesInternalToken(bearer.token)) {
    return {
      via: 'bearer',
      token: bearer.token,
      user: { id: 'internal-admin', email: DEFAULT_ADMIN_EMAILS[0]!, name: 'Vigas System Admin', role: 'admin', accountId: '' },
    };
  }
  // Check zero-latency HMAC admin bridge cookie first before hitting Postgres.
  const bridgeRaw = readCookieValue(req.headers.get('cookie'), ADMIN_BRIDGE_COOKIE);
  const bridgeUser = verifyAdminBridgeToken(bridgeRaw);
  if (bridgeUser) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const bad = originMismatch(req);
      if (bad) return bad;
    }
    return {
      via: 'cookie',
      token: bridgeRaw!,
      user: bridgeUser,
    };
  }
  const auth = await requireAuth(req);
  if (!(auth instanceof NextResponse)) {
    if (!isAdminUser(auth.user)) return apiError(404, 'not_found', 'Not found.');
    return auth;
  }
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

/**
 * Resolves the signed-in admin for request-time Server Components from either the zero-latency
 * signed `vigas_admin_bridge` cookie or the Postgres `vigas_session` cookie.
 */
export async function getCurrentAdminUser(): Promise<{ user: SessionUser; via: 'postgres' | 'supabase_bridge' } | null> {
  const cookieStore = await cookies();
  const bridgeRaw = cookieStore.get(ADMIN_BRIDGE_COOKIE)?.value;
  if (bridgeRaw) {
    await connection();
    const bridgeUser = verifyAdminBridgeToken(bridgeRaw);
    if (bridgeUser) return { user: bridgeUser, via: 'supabase_bridge' };
  }
  const user = await getCurrentUser();
  if (user) {
    if (!isAdminUser(user)) return null;
    return { user, via: 'postgres' };
  }
  return null;
}

/** For request-time admin pages (inside <Suspense>). */
export async function getAdminUser(): Promise<SessionUser> {
  const resolved = await getCurrentAdminUser();
  if (!resolved) notFound();
  return resolved.user;
}

/** Makes edits visible right away on cached public pages. */
export function refreshContent(kind: 'news' | 'tools', slugs: Array<string | null | undefined>): void {
  revalidateTag(kind, { expire: 0 });
  for (const slug of slugs) {
    if (slug) revalidateTag(kind === 'news' ? `article:${slug}` : `tool:${slug}`, { expire: 0 });
  }
}

/** Extracts a concise Postgres / driver error code if present. */
export function extractDbError(err: unknown): { code: string; message: string } | null {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } } | null;
  if (!e) return null;
  const code = e.code || e.cause?.code;
  const message = e.cause?.message || e.message || '';
  if (
    code ||
    /password authentication failed|connect_timeout|econnrefused|enotfound|database_url|relation .* does not exist/i.test(message)
  ) {
    return { code: String(code || 'db_error'), message: message || 'Database unavailable.' };
  }
  return null;
}

/** Turns validation errors from @vigas/db into 400 and DB connectivity errors into 503. */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminInputError) return apiError(400, 'invalid_input', err.message);
  const dbErr = extractDbError(err);
  if (dbErr) {
    const hint =
      dbErr.code === '28P01'
        ? 'Postgres password authentication failed (28P01). Update DATABASE_URL in Vercel Environment Variables and run Bootstrap.'
        : dbErr.code === '42P01'
          ? 'Vigas schema tables are not initialized yet (42P01). Tap "Bootstrap vigas schema" to initialize.'
          : `Database unavailable (${dbErr.code}): ${dbErr.message}`;
    return apiError(503, dbErr.code, hint);
  }
  throw err;
}
