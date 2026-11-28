'use client';

import { api, notifyAuthChanged } from './session';
import { getSupabase, syncSignedInHint } from './supabase';

let lastToken: string | null = null;
let inFlight: { token: string; promise: Promise<boolean> } | null = null;

/**
 * Bridges the current Supabase JWT into a first-party `vigas_session` cookie so `/`, `/dashboard`,
 * `/auth`, and `/chat` operate on a single sign-in. Deduplicates repeated/concurrent calls.
 */
export async function exchangeSupabaseSession(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  if (lastToken === accessToken) {
    syncSignedInHint(true);
    return true;
  }
  if (inFlight && inFlight.token === accessToken) {
    return inFlight.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/auth/exchange', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      if (!res.ok) return false;
      lastToken = accessToken;
      syncSignedInHint(true);
      return true;
    } catch {
      return false;
    } finally {
      if (inFlight?.token === accessToken) inFlight = null;
    }
  })();

  inFlight = { token: accessToken, promise };
  return promise;
}

/** Signs out of BOTH the Vigas Postgres session cookie and the shared Supabase session for `/chat`. */
export async function signOutEverywhere(): Promise<void> {
  lastToken = null;
  inFlight = null;
  try {
    window.sessionStorage.removeItem('vigas_dash_cache_v2');
  } catch {
    // Ignore
  }
  await Promise.allSettled([api.logout(), getSupabase().auth.signOut()]);
  syncSignedInHint(false);
  notifyAuthChanged();
}
