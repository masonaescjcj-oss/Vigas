'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ModelListItem, PublicUser, WalletResponse } from '@vigas/core';
import { api } from '@/lib/client/session';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { consumeAuthNext, getSupabase, hydrateSessionFromUrl, syncSignedInHint } from '@/lib/client/supabase';
import { fetchSupabaseAccount, type SupabaseUsageSummary } from '@/lib/client/supabase-account';
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

  useEffect(() => {
    if (resolved) return;
    let active = true;

    const resolveFromSession = async (session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }) => {
      if (!active || !session.user?.email) return;
      syncSignedInHint(true);
      consumeAuthNext();

      const userName =
        (typeof session.user.user_metadata?.full_name === 'string' && session.user.user_metadata.full_name) ||
        (typeof session.user.user_metadata?.name === 'string' && session.user.user_metadata.name) ||
        null;
      const publicUser: PublicUser = {
        id: session.user.id,
        email: session.user.email,
        name: userName,
      };

      // Try Postgres exchange first when DATABASE_URL is enabled; otherwise fall back to Supabase backend seamlessly.
      const exchanged = await exchangeSupabaseSession(session.access_token).catch(() => false);
      if (exchanged && active) {
        try {
          const pgWallet = await api.wallet();
          if (active) {
            setResolved({
              user: publicUser,
              wallet: pgWallet,
              backend: 'postgres',
              supabaseRpcReady: true,
              supabaseUsage: null,
            });
            return;
          }
        } catch {
          // Fall through to Supabase backend
        }
      }

      const supaAccount = await fetchSupabaseAccount();
      if (!active) return;
      setResolved({
        user: publicUser,
        wallet: supaAccount.wallet,
        backend: 'supabase',
        supabaseRpcReady: supaAccount.rpcReady,
        supabaseUsage: supaAccount.usage,
      });
    };

    const load = async () => {
      // First consume any `#access_token=...` or `?code=...` directly from the URL (Google OAuth landing on /dashboard).
      const { session } = await hydrateSessionFromUrl();
      if (!active) return;
      if (session?.user?.email) {
        await resolveFromSession(session);
        return;
      }

      // Brief grace wait in case supabase-js finishes initializing from localStorage/event asynchronously.
      await new Promise((r) => setTimeout(r, 250));
      if (!active) return;
      const { data } = await getSupabase().auth.getSession();
      if (data.session?.user?.email) {
        await resolveFromSession(data.session);
        return;
      }

      if (active) {
        syncSignedInHint(false);
        router.replace('/signin?next=/dashboard');
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [resolved, router]);

  if (!resolved) {
    return (
      <div aria-busy="true" aria-label={isFa ? 'در حال بارگذاری پنل کاربری' : 'Loading your API console'}>
        <p style={{ margin: '-8px 0 24px', color: 'var(--vg-ink3)' }}>
          {isFa ? 'در حال اتصال به حساب و بارگذاری پنل API…' : 'Connecting your account and loading API console…'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: 104, borderRadius: 18 }} />
          ))}
        </div>
        <div className="card" style={{ height: 340, borderRadius: 22 }} />
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
      lang={lang}
    />
  );
}
