'use client';

import { useSyncExternalStore } from 'react';
import { getStoredSessionEmail } from './supabase-config';
import { getSupabase } from './supabase';

const CLIENT_ADMIN_HINT_EMAILS = ['ma.sonaescjcj@gmail.com'];

/** UI hint check only — server APIs & SSR pages always verify admin access cryptographically. */
export function isAdminHintEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return CLIENT_ADMIN_HINT_EMAILS.includes(email.trim().toLowerCase());
}

function readAdminHint(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.cookie.split(';').some((c) => c.trim() === 'vigas_is_admin=1')) return true;
  return isAdminHintEmail(getStoredSessionEmail());
}

function subscribeAdminHint(cb: () => void) {
  window.addEventListener('vigas-auth', cb);
  window.addEventListener('focus', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('vigas-auth', cb);
    window.removeEventListener('focus', cb);
    window.removeEventListener('storage', cb);
  };
}

/** Reactive boolean hint indicating whether the current browser session belongs to an admin account. */
export function useAdminHint(): boolean {
  return useSyncExternalStore(subscribeAdminHint, readAdminHint, () => false);
}

/**
 * Authenticated fetch for `/api/admin/*`: sends both same-origin cookies (`vigas_session` /
 * `vigas_admin_bridge`) AND the live Supabase Bearer JWT when available.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Authorization')) {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (data.session?.access_token) {
        headers.set('Authorization', `Bearer ${data.session.access_token}`);
      }
    } catch {
      // Cookie auth still applies
    }
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers,
  });
}
