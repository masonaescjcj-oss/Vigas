'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';

let client: SupabaseClient | null = null;
const AUTH_NEXT_KEY = 'vigas_auth_next';

/** Browser Supabase client (singleton). Session persists in localStorage, shared with /chat. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Picks up `#access_token=…` after Google sign-in and email links.
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    });
    client.auth.onAuthStateChange((_event, session) => syncSignedInHint(Boolean(session)));
  }
  return client;
}

/**
 * Mirrors the Supabase session into the readable `vigas_signed_in` marker so static pages (header, mobile
 * menu) can show signed-in navigation. Never grants access — every API call sends the real token.
 */
export function syncSignedInHint(signedIn: boolean): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = signedIn
    ? `vigas_signed_in=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
    : `vigas_signed_in=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event('vigas-auth'));
}

function isSafeInternalPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

/** Persists post-OAuth destination in both sessionStorage and a short-lived cookie. */
export function saveAuthNext(dest: string): void {
  if (typeof window === 'undefined' || !isSafeInternalPath(dest)) return;
  try {
    window.sessionStorage.setItem(AUTH_NEXT_KEY, dest);
  } catch {
    // Ignore storage errors
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${AUTH_NEXT_KEY}=${encodeURIComponent(dest)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
  } catch {
    // Ignore cookie errors
  }
}

/** Reads and clears the saved post-OAuth destination if present. */
export function consumeAuthNext(): string | null {
  if (typeof window === 'undefined') return null;
  let found: string | null = null;
  try {
    const stored = window.sessionStorage.getItem(AUTH_NEXT_KEY);
    if (isSafeInternalPath(stored)) found = stored;
    window.sessionStorage.removeItem(AUTH_NEXT_KEY);
  } catch {
    // Ignore
  }
  try {
    const prefix = `${AUTH_NEXT_KEY}=`;
    for (const part of document.cookie.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        const decoded = decodeURIComponent(trimmed.slice(prefix.length));
        if (!found && isSafeInternalPath(decoded)) found = decoded;
      }
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${AUTH_NEXT_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // Ignore
  }
  return found;
}

/** True when the current URL carries an OAuth/Supabase callback hash or PKCE code. */
export function hasOAuthCallbackInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hash;
  const s = window.location.search;
  return (
    h.includes('access_token=') ||
    h.includes('refresh_token=') ||
    h.includes('error=') ||
    s.includes('code=') ||
    s.includes('error_description=')
  );
}

/**
 * Explicitly consumes `#access_token=...` / `#refresh_token=...` or `?code=...` from the browser URL
 * so OAuth completion never races with `getSession()` or gets dropped by redirects.
 */
export async function hydrateSessionFromUrl(): Promise<{ session: Session | null; error: string | null }> {
  const supabase = getSupabase();
  if (typeof window === 'undefined') return { session: null, error: null };

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  const oauthError =
    hashParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error_description') ||
    queryParams.get('error');

  if (oauthError) {
    window.history.replaceState(null, '', window.location.pathname);
    return { session: null, error: oauthError };
  }

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (error) return { session: null, error: error.message };
    if (data.session) {
      syncSignedInHint(true);
      return { session: data.session, error: null };
    }
  }

  const code = queryParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    queryParams.delete('code');
    const nextSearch = queryParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    if (error) return { session: null, error: error.message };
    if (data.session) {
      syncSignedInHint(true);
      return { session: data.session, error: null };
    }
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) syncSignedInHint(true);
  return { session: data.session, error: null };
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

/** Calls a whitelisted Supabase Edge Function through the same-origin `/api/fn/*` proxy (no CORS setup needed). */
export async function callFunction<T>(name: 'usage-check' | 'checkout-create', body?: unknown): Promise<T> {
  const session = await currentSession();
  if (!session) throw new AccountError(401, 'UNAUTHORIZED', 'Please sign in again.');
  const res = await fetch(`/api/fn/${name}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: { code?: string; message?: string } | string; message?: string; code?: string })
    | null;
  if (!res.ok || !data) {
    const err = data?.error;
    const code = (typeof err === 'object' && err?.code) || data?.code || `HTTP_${res.status}`;
    const message = (typeof err === 'object' && err?.message) || (typeof err === 'string' ? err : '') || data?.message || `Request failed (${res.status}).`;
    throw new AccountError(res.status, code, message);
  }
  return data;
}
