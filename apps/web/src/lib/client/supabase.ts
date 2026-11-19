'use client';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';

let client: SupabaseClient | null = null;

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
