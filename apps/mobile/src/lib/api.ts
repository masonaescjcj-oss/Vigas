import { ApiError, VigasApi } from '@vigas/api-client';
import { fetch as expoFetch } from 'expo/fetch';

import { getToken } from './token';

/** Base URL of the Vigas website/API, e.g. `http://10.0.2.2:3000` for the Android emulator. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

/** Without an API URL every screen runs on the bundled demo data. */
export const apiConfigured = API_URL.length > 0;

/** Public site used for share links. */
export const SITE_URL = 'https://vigas.ai';

/**
 * `expo/fetch` streams response bodies, which `api.chat` needs for token-by-token output. It's wrapped
 * so it's never invoked as a method of the client (on web it is `window.fetch`, which rejects a foreign `this`).
 */
export const api = new VigasApi({ baseUrl: API_URL, getToken, fetch: (input, init) => expoFetch(input, init) });

export { ApiError };

export class OfflineError extends Error {
  constructor(message = 'Vigas is unreachable right now.') {
    super(message);
  }
}

/** Rejects after `ms` so a dead server never leaves a screen spinning. */
export function withTimeout<T>(promise: Promise<T>, ms = 9000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OfflineError('The request timed out.')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function isUnauthorized(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/** Human-readable message for any error thrown by the API layer. */
export function errorMessage(e: unknown): string {
  if (!apiConfigured) return 'No server configured. Set EXPO_PUBLIC_API_URL to connect to Vigas.';
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Your session has expired. Sign in again.';
    if (e.status === 402 || e.code === 'insufficient_credits') return 'Not enough credits. Top up in Wallet.';
    if (e.status === 429) return 'Slow down a little — too many requests.';
    return e.message || `Request failed (${e.status}).`;
  }
  if (e instanceof OfflineError) return e.message;
  return 'Couldn’t reach Vigas. Check your connection and try again.';
}
