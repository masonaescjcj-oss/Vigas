'use client';

import { useEffect } from 'react';
import { isAdminHintEmail } from '@/lib/client/admin-fetch';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { consumeAuthNext, hasOAuthCallbackInUrl, hydrateSessionFromUrl, syncSignedInHint } from '@/lib/client/supabase';
import { getStoredSessionSnapshot } from '@/lib/client/supabase-config';

let adminPrewarmed = false;

/**
 * Global lightweight OAuth callback catcher & admin cookie pre-warmer mounted in the root layout.
 * - Captures `#access_token=...` or `?code=...` redirects and routes smoothly into `/dashboard`.
 * - Silently pre-warms `vigas_admin_bridge` in the background for signed-in admin accounts so opening
 *   `/admin/*` never pauses on "Verifying admin session…".
 */
export function AuthHashBridge() {
  useEffect(() => {
    // 1. Background admin cookie pre-warm (zero UI impact, runs once per tab).
    if (!adminPrewarmed && typeof document !== 'undefined') {
      const hasAdminCookie = document.cookie.split(';').some((c) => c.trim() === 'vigas_is_admin=1');
      const snap = getStoredSessionSnapshot();
      if (!hasAdminCookie && snap && isAdminHintEmail(snap.email)) {
        adminPrewarmed = true;
        void fetch('/api/admin/session', {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${snap.accessToken}`, Accept: 'application/json' },
          cache: 'no-store',
        }).catch(() => undefined);
      }
    }

    // 2. OAuth callback handler.
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
