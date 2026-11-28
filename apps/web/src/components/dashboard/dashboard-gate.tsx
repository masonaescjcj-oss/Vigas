'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ModelListItem, PublicUser, WalletResponse } from '@vigas/core';
import { api } from '@/lib/client/session';
import { isAdminHintEmail } from '@/lib/client/admin-fetch';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { consumeAuthNext, getSupabase, hasOAuthCallbackInUrl, hydrateSessionFromUrl, syncSignedInHint } from '@/lib/client/supabase';
import { getStoredSessionSnapshot } from '@/lib/client/supabase-config';
import {
  emptyWallet,
  fetchSupabaseUsage,
  fetchSupabaseWalletFast,
  readCachedDashboardSnapshot,
  writeCachedDashboardSnapshot,
  type SupabaseUsageSummary,
} from '@/lib/client/supabase-account';
import { DashboardClient } from './dashboard-client';

interface ResolvedAccount {
  user: PublicUser;
  wallet: WalletResponse;
  backend: 'postgres' | 'supabase';
  supabaseRpcReady: boolean;
  supabaseUsage: SupabaseUsageSummary | null;
}

export function DashboardGate({
  initialUser,
  initialWallet,
  models,
  paymentMode,
  lang = 'en',
}: {
  initialUser: PublicUser | null;
  initialWallet: WalletResponse | null;
  models: ModelListItem[];
  paymentMode: 'avexpay' | 'test' | 'none';
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const router = useRouter();
  const hasServerInitial = Boolean(initialUser && initialWallet);

  const [resolved, setResolved] = useState<ResolvedAccount | null>(() =>
    initialUser && initialWallet
      ? {
          user: initialUser,
          wallet: initialWallet,
          backend: 'postgres',
          supabaseRpcReady: true,
          supabaseUsage: null,
        }
      : null,
  );
  const [syncing, setSyncing] = useState(!hasServerInitial);

  useEffect(() => {
    if (hasServerInitial) return;
    let active = true;

    // Step 0 (0ms): Synchronously hydrate from sessionStorage cache or localStorage session
    // so the real Dashboard UI paints instantly without any blank "Connecting..." blocker.
    const stored = getStoredSessionSnapshot();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only sessionStorage/localStorage hydration */
    if (stored) {
      const cached = readCachedDashboardSnapshot(stored.id);
      if (cached) {
        setResolved({
          user: { id: cached.userId, email: cached.email, name: cached.name },
          wallet: cached.wallet,
          backend: cached.backend,
          supabaseRpcReady: cached.rpcReady,
          supabaseUsage: cached.usage,
        });
        setSyncing(false);
      } else {
        setResolved({
          user: { id: stored.id, email: stored.email, name: stored.name },
          wallet: emptyWallet(),
          backend: 'supabase',
          supabaseRpcReady: true,
          supabaseUsage: null,
        });
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    const resolveFromSession = async (session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }) => {
      if (!active || !session.user?.email) return;
      syncSignedInHint(true);
      const savedNext = consumeAuthNext();

      // Pre-warm the signed httpOnly admin bridge cookie in the background (never blocks dashboard render).
      if (isAdminHintEmail(session.user.email)) {
        const warm = fetch('/api/admin/session', {
          method: 'POST',
          credentials: 'include',
          headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
          cache: 'no-store',
        }).catch(() => undefined);
        if (savedNext && savedNext.startsWith('/admin')) {
          await warm;
          if (active) {
            window.location.assign(savedNext);
            return;
          }
        }
      }

      const userName =
        (typeof session.user.user_metadata?.full_name === 'string' && session.user.user_metadata.full_name) ||
        (typeof session.user.user_metadata?.name === 'string' && session.user.user_metadata.name) ||
        null;
      const publicUser: PublicUser = {
        id: session.user.id,
        email: session.user.email,
        name: userName,
      };

      // Run Postgres exchange AND fast Supabase wallet fetch in PARALLEL (eliminates 2–4s sequential waterfall!).
      const exchangePromise = exchangeSupabaseSession(session.access_token)
        .then(async (ok) => {
          if (!ok) return null;
          return api.wallet().catch(() => null);
        })
        .catch(() => null);

      const supaWalletPromise = fetchSupabaseWalletFast(session.access_token);

      // Show whichever resolves cleanly first (usually fast Supabase RPC or Postgres wallet in ~150-300ms).
      const [pgWallet, supaCore] = await Promise.all([
        exchangePromise.catch(() => null),
        supaWalletPromise.catch(() => ({ wallet: emptyWallet(), rpcReady: false })),
      ]);
      if (!active) return;

      const finalAccount: ResolvedAccount = pgWallet
        ? {
            user: publicUser,
            wallet: pgWallet,
            backend: 'postgres',
            supabaseRpcReady: true,
            supabaseUsage: null,
          }
        : {
            user: publicUser,
            wallet: supaCore.wallet,
            backend: 'supabase',
            supabaseRpcReady: supaCore.rpcReady,
            supabaseUsage: null,
          };

      setResolved((prev) => ({
        ...finalAccount,
        supabaseUsage: prev?.supabaseUsage ?? finalAccount.supabaseUsage,
      }));
      setSyncing(false);

      writeCachedDashboardSnapshot({
        userId: publicUser.id,
        email: publicUser.email,
        name: publicUser.name,
        backend: finalAccount.backend,
        wallet: finalAccount.wallet,
        rpcReady: finalAccount.supabaseRpcReady,
        usage: finalAccount.supabaseUsage,
      });

      // Load slower Edge Function usage stats strictly in the background — NEVER blocks wallet or keys.
      if (finalAccount.backend === 'supabase') {
        void fetchSupabaseUsage().then((usage) => {
          if (!active || !usage) return;
          setResolved((prev) => (prev ? { ...prev, supabaseUsage: usage } : prev));
          writeCachedDashboardSnapshot({
            userId: publicUser.id,
            email: publicUser.email,
            name: publicUser.name,
            backend: finalAccount.backend,
            wallet: finalAccount.wallet,
            rpcReady: finalAccount.supabaseRpcReady,
            usage,
          });
        });
      }
    };

    const load = async () => {
      const hasOAuth = hasOAuthCallbackInUrl();
      if (!stored && !hasOAuth) {
        const { data } = await getSupabase().auth.getSession();
        if (!active) return;
        if (data.session?.user?.email) {
          await resolveFromSession(data.session);
          return;
        }
        syncSignedInHint(false);
        router.replace('/signin?next=/dashboard');
        return;
      }

      const { session } = await hydrateSessionFromUrl();
      if (!active) return;
      if (session?.user?.email) {
        await resolveFromSession(session);
        return;
      }

      syncSignedInHint(false);
      router.replace('/signin?next=/dashboard');
    };

    void load();
    return () => {
      active = false;
    };
  }, [hasServerInitial, router]);

  if (!resolved) {
    return (
      <div className="dash-body" aria-busy="true" aria-label={isFa ? 'در حال باز کردن پنل کاربری' : 'Opening your API console'} style={{ maxWidth: 680, margin: '24px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: 24, borderRadius: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="spin" aria-hidden="true" />
          <span style={{ color: 'var(--vg-ink2)', fontSize: 14.5 }}>
            {isFa ? 'در حال ورود به پنل کاربری…' : 'Opening your API console…'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <DashboardClient
      user={resolved.user}
      initial={resolved.wallet}
      models={models}
      paymentMode={paymentMode}
      backend={resolved.backend}
      supabaseRpcReady={resolved.supabaseRpcReady}
      supabaseUsage={resolved.supabaseUsage}
      syncing={syncing}
      lang={lang}
    />
  );
}
