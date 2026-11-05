'use client';

import { useSyncExternalStore } from 'react';
import { VigasApi } from '@vigas/api-client';

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
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('focus', cb);
  };
}

/**
 * True when the readable `vigas_signed_in` marker cookie is present. It only drives navigation
 * hints; the API still checks the real session on every call.
 */
export function useSignedInHint(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.cookie.split(';').some((c) => c.trim() === 'vigas_signed_in=1'),
    () => false,
  );
}

/** Redirect target from `?next=`, limited to same-site paths. */
export function safeNext(fallback = '/dashboard'): string {
  if (typeof window === 'undefined') return fallback;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
