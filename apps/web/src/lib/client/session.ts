'use client';

import { useSyncExternalStore } from 'react';
import { VigasApi } from '@vigas/api-client';
import { hasStoredSession } from './supabase-config';

/** Same-origin API client. The session cookie is sent automatically. */
export const api = new VigasApi({ baseUrl: '' });

const EVENT = 'vigas-auth';

/** Call after sign-in or sign-out so signed-in navigation updates without a reload. */
export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('focus', cb);
  // Signing in or out in another tab (or inside /chat) updates localStorage.
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('focus', cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * True when the readable `vigas_signed_in` marker cookie is present or a shared Supabase session is stored
 * (one account for vigas.app and /chat). It only drives navigation hints; APIs always verify the real token.
 */
export function useSignedInHint(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.cookie.split(';').some((c) => c.trim() === 'vigas_signed_in=1') || hasStoredSession(),
    () => false,
  );
}

/** Redirect target from `?next=`, limited to same-site paths. */
export function safeNext(fallback = '/dashboard'): string {
  if (typeof window === 'undefined') return fallback;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
