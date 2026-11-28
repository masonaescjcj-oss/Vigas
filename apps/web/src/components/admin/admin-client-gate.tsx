'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { getSupabase, hasOAuthCallbackInUrl, hydrateSessionFromUrl, syncSignedInHint } from '@/lib/client/supabase';
import { getStoredSessionSnapshot } from '@/lib/client/supabase-config';
import { Icon } from '../ui';

const RELOAD_GUARD_KEY = 'vigas_admin_bridge_reload_ts';

function canReloadOnce(pathname: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { path?: string; ts?: number };
      if (parsed.path === pathname && typeof parsed.ts === 'number' && Date.now() - parsed.ts < 15_000) {
        return false;
      }
    }
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ path: pathname, ts: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

function clearReloadGuard() {
  try {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // Ignore storage failures
  }
}

interface AdminSessionResponse {
  ok?: boolean;
  email?: string;
  previewMode?: boolean;
  dbConnected?: boolean;
  dbCode?: string | null;
  dbError?: string | null;
  bridgeSet?: boolean;
}

/**
 * Client-side bridge for `/admin/*` when neither `vigas_session` nor `vigas_admin_bridge` cookie
 * is present yet (e.g., user signed in via Google/Supabase Auth). Calls `POST /api/admin/session`
 * to mint the signed httpOnly `vigas_admin_bridge` cookie (which works even when Postgres has 28P01),
 * performs at most ONE reload guarded by sessionStorage, and never enters a reload loop.
 */
export function AdminClientGate({ previewMode }: { previewMode: boolean }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin/providers';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: 'checking' }
    | { status: 'denied'; email?: string }
    | { status: 'bridge_blocked'; email: string; dbConnected: boolean; dbCode?: string | null; dbError?: string | null }
    | { status: 'error'; message: string }
  >({ status: 'checking' });

  useEffect(() => {
    let active = true;

    const run = async () => {
      setState({ status: 'checking' });

      // Fast path: read locally stored Supabase token synchronously (0ms) instead of sleeping.
      const snap = !hasOAuthCallbackInUrl() ? getStoredSessionSnapshot() : null;
      let accessToken = snap?.accessToken ?? null;
      let userEmail = snap?.email ?? undefined;

      if (!accessToken) {
        const hydrated = await hydrateSessionFromUrl().catch(() => ({ session: null }));
        let session = hydrated.session;
        if (!session) {
          const { data } = await getSupabase().auth.getSession();
          session = data.session;
        }
        accessToken = session?.access_token ?? null;
        userEmail = session?.user?.email ?? undefined;
      }
      if (!active) return;

      if (!accessToken) {
        clearReloadGuard();
        router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }

      syncSignedInHint(true);

      // Step 1: Mint signed httpOnly `vigas_admin_bridge` cookie (zero DB dependency) + probe DB.
      try {
        const res = await fetch('/api/admin/session', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        });
        if (!active) return;

        if (!res.ok) {
          clearReloadGuard();
          setState({ status: 'denied', email: userEmail });
          return;
        }

        const data = (await res.json()) as AdminSessionResponse;
        const email = data.email ?? userEmail ?? 'admin';

        // Step 2: Best-effort Postgres cookie exchange in background (never blocks admin shell entry).
        if (!previewMode && data.dbConnected) {
          void exchangeSupabaseSession(accessToken).catch(() => false);
        }

        // Step 3: Reload at most ONCE so SSR AdminGate picks up the newly set cookie and renders full AdminShell.
        if (data.bridgeSet && canReloadOnce(pathname)) {
          window.location.replace(pathname);
          return;
        }

        // Guard fired (or cookies blocked): NEVER loop! Show clear status + manual action.
        setState({
          status: 'bridge_blocked',
          email,
          dbConnected: Boolean(data.dbConnected),
          dbCode: data.dbCode,
          dbError: data.dbError,
        });
      } catch {
        if (active) {
          setState({
            status: 'error',
            message: 'Could not verify admin session right now. Check your connection and retry.',
          });
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [attempt, pathname, previewMode, router]);

  if (state.status === 'checking') {
    return (
      <div className="card" style={{ padding: 26, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="spin" aria-hidden="true" />
        <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14.5 }}>Verifying admin session…</p>
      </div>
    );
  }

  if (state.status === 'denied') {
    return (
      <div className="card" style={{ padding: 26, borderRadius: 20, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Admin access required</h2>
        <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.6 }}>
          You are signed in as <code className="mn">{state.email ?? 'a non-admin account'}</code>, which does not have admin privileges. Sign in with
          your admin email to continue.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className="btn key">
            Switch account
          </Link>
          <Link href="/dashboard" className="btn gh">
            Back to API Console
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="card" style={{ padding: 26, borderRadius: 20, display: 'grid', gap: 14 }}>
        <p style={{ margin: 0, color: 'var(--vg-red)', fontSize: 14.5 }}>{state.message}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn key"
            onClick={() => {
              clearReloadGuard();
              setAttempt((n) => n + 1);
            }}
          >
            <Icon name="refresh" size={15} />
            Retry verification
          </button>
          <Link href="/dashboard" className="btn gh">
            Back to API Console
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24, borderRadius: 20, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="led" aria-hidden="true" />
        <strong>Admin verified ({state.email})</strong>
        {!state.dbConnected && (
          <span className="adm-pill warn">DB {state.dbCode ?? 'offline'}</span>
        )}
      </div>
      <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.6 }}>
        Your Supabase admin session is verified, but the browser did not retain the admin session cookie (or cookies are restricted in this view).
        Tap below to open the Admin Panel again, or make sure first-party cookies are enabled for <code className="mn">vigas.app</code>.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn key"
          onClick={() => {
            clearReloadGuard();
            window.location.replace(pathname);
          }}
        >
          Open Admin Panel
        </button>
        <Link href="/dashboard" className="btn gh">
          API Console
        </Link>
      </div>
    </div>
  );
}
