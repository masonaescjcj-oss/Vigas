import { ApiError, VigasApi } from '@vigas/api-client';
import { fetch as expoFetch } from 'expo/fetch';

import { getToken } from './token';

/** Base URL of the Vigas website/API, e.g. `http://10.0.2.2:3000` for the Android emulator. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

/** Without an API URL every screen runs on the bundled demo data. */
export const apiConfigured = API_URL.length > 0;

/** Public site used for share links and Play-compliant external browser checkout. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || API_URL || 'https://vigas.app').trim().replace(/\/+$/, '');

/** Shared Supabase project for one-account SSO across web, /chat, and mobile. */
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jasgepmskcsyvqoesocc.supabase.co')
  .trim()
  .replace(/\/+$/, '');

export const SUPABASE_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9'
).trim();

/** External web checkout URL on vigas.app (AvexPay Crypto + Telegram Stars). */
export function checkoutUrl(amountUsd: number): string {
  const rounded = Math.max(1, Math.min(1000, Math.round(amountUsd)));
  return `${SITE_URL}/dashboard?topup=${rounded}#credits`;
}

/** Full RetroCode AI Chat & Studio web URL on vigas.app/chat. */
export function studioChatUrl(modelId?: string): string {
  return modelId ? `${SITE_URL}/chat?model=${encodeURIComponent(modelId)}` : `${SITE_URL}/chat`;
}

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
    if (e.status === 402 || e.code === 'insufficient_credits') return 'Not enough credits. Top up on vigas.app.';
    if (e.status === 429) return 'Slow down a little — too many requests.';
    return e.message || `Request failed (${e.status}).`;
  }
  if (e instanceof OfflineError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Couldn’t reach Vigas. Check your connection and try again.';
}
