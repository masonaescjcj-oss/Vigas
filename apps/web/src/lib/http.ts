import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getRequestAuth, type RequestAuth } from './auth';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** `{ error: { code, message } }` with the given status. */
export function apiError(status: number, code: string, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...(headers ?? {}) } });
}

/** JSON response for user-specific data: never cached by browsers or proxies. */
export function privateJson(body: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status ?? 200, headers: NO_STORE });
}

/** JSON response for public data that may be cached briefly by browsers and CDNs. */
export function publicJson(body: unknown, maxAge = 60): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 5}` },
  });
}

export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 256 * 1024) return { ok: false, res: apiError(413, 'payload_too_large', 'Request body is too large.') };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, res: apiError(400, 'invalid_json', 'Request body must be valid JSON.') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, res: apiError(400, 'invalid_request', `${where}${issue?.message ?? 'Invalid request.'}`) };
  }
  return { ok: true, data: parsed.data };
}

function requestHost(req: Request): string | null {
  return req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host');
}

/**
 * CSRF guard for state-changing requests that rely on cookies: when an `Origin` header is present it
 * must match the host the request was sent to.
 */
export function originMismatch(req: Request): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return apiError(403, 'bad_origin', 'Cross-site request rejected.');
  }
  const host = requestHost(req);
  if (!host || originHost !== host) return apiError(403, 'bad_origin', 'Cross-site request rejected.');
  return null;
}

/**
 * Resolves the signed-in user from the session cookie or a bearer token. For cookie-authenticated
 * POST/PUT/PATCH/DELETE requests the Origin check runs as well.
 */
export async function requireAuth(req: Request): Promise<RequestAuth | NextResponse> {
  const auth = await getRequestAuth(req);
  if (!auth) return apiError(401, 'unauthorized', 'Sign in to continue.');
  if (auth.via === 'cookie' && req.method !== 'GET' && req.method !== 'HEAD') {
    const bad = originMismatch(req);
    if (bad) return bad;
  }
  return auth;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets: Map<string, Bucket> = ((globalThis as { __vigasRateLimit?: Map<string, Bucket> }).__vigasRateLimit ??=
  new Map());

/** Fixed-window, in-memory rate limit (per server process). Returns a 429 response when exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > limit) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return apiError(429, 'rate_limited', 'Too many attempts. Try again in a minute.', { 'Retry-After': String(retry) });
  }
  return null;
}
