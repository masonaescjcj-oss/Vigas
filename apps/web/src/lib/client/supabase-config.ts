/**
 * Public Supabase settings shared by vigas.app and vigas.app/chat.
 *
 * Both apps run on the same origin and use the same project with supabase-js's default storage key,
 * so a session created on /signin is picked up by /chat and vice versa — one account, one sign-in.
 * Dependency-free on purpose: the header imports it without pulling supabase-js into every page.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jasgepmskcsyvqoesocc.supabase.co';

/** Publishable (anon) key — safe in the browser; row-level security and RPC checks guard the data. */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9';

/** supabase-js default: `sb-<project-ref>-auth-token` (the Expo chat app uses the same key in localStorage). */
export const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/** Public OpenAI-compatible endpoint shown in quickstarts. */
export const API_BASE_URL = 'https://api.vigas.ai/v1';

/** True when a (possibly expired) Supabase session is stored in this browser. Cheap; no network. */
export function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string } | null;
    return Boolean(parsed?.refresh_token || parsed?.access_token);
  } catch {
    return false;
  }
}
