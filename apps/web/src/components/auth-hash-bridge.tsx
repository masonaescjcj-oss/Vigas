'use client';

import { useEffect } from 'react';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { consumeAuthNext, hasOAuthCallbackInUrl, hydrateSessionFromUrl, syncSignedInHint } from '@/lib/client/supabase';

/**
 * Global lightweight OAuth callback catcher mounted in the root layout.
 * If Supabase redirects back to `/`, `/fa`, `/signin`, or `/dashboard` with `#access_token=...` or `?code=...`,
 * this persists the session immediately and routes the user into their Vigas API Console (`/dashboard`).
 */
export function AuthHashBridge() {
  useEffect(() => {
    if (!hasOAuthCallbackInUrl()) return;
    // Let dedicated auth/dashboard screens handle their own callback if we're already on them.
    const path = window.location.pathname;
    if (path === '/signin' || path === '/signup' || path === '/fa-app/signin' || path === '/fa-app/signup' || path === '/dashboard') {
      return;
    }

    let active = true;
    void (async () => {
      const { session } = await hydrateSessionFromUrl();
      if (!active || !session) return;
      syncSignedInHint(true);
      await exchangeSupabaseSession(session.access_token).catch(() => false);
      if (!active) return;
      const dest = consumeAuthNext() || '/dashboard';
      window.location.assign(dest);
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
