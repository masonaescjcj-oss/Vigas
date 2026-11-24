'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { exchangeSupabaseSession } from '@/lib/client/session-sync';
import { getSupabase, hydrateSessionFromUrl } from '@/lib/client/supabase';

/**
 * Client-side bridge for `/admin/*` when a first-party Postgres `vigas_session` cookie isn't
 * present yet (e.g., user signed in via Google/Supabase Auth, or Vercel is running in PREVIEW_MODE
 * without DATABASE_URL). Exchanges the Supabase session automatically or guides the admin cleanly.
 */
export function AdminClientGate({ previewMode }: { previewMode: boolean }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin/providers';
  const [state, setState] = useState<
    | { status: 'checking' }
    | { status: 'denied'; email?: string }
    | { status: 'preview_admin'; email: string }
    | { status: 'error'; message: string }
  >({ status: 'checking' });

  useEffect(() => {
    let active = true;

    const run = async () => {
      const hydrated = await hydrateSessionFromUrl().catch(() => ({ session: null }));
      let session = hydrated.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 200));
        const { data } = await getSupabase().auth.getSession();
        session = data.session;
      }
      if (!active) return;

      if (!session?.access_token) {
        router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }

      // If Postgres is configured, exchange the Supabase JWT for a vigas_session cookie and reload SSR Admin.
      if (!previewMode) {
        const exchanged = await exchangeSupabaseSession(session.access_token).catch(() => false);
        if (!active) return;
        if (exchanged) {
          router.refresh();
          // Give Next.js a moment to re-render the Server Component with the new cookie.
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // Verify admin status server-side using the Supabase access token.
      try {
        const res = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (!active) return;
        if (!res.ok) {
          setState({ status: 'denied', email: session.user?.email ?? undefined });
          return;
        }
        const data = (await res.json()) as { email: string; previewMode: boolean };
        if (!data.previewMode) {
          window.location.reload();
          return;
        }
        setState({ status: 'preview_admin', email: data.email });
      } catch {
        if (active) setState({ status: 'error', message: 'Could not verify admin session right now. Try refreshing.' });
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [pathname, previewMode, router]);

  if (state.status === 'checking') {
    return (
      <div className="card" style={{ padding: 28, borderRadius: 20 }}>
        <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Verifying admin session…</p>
      </div>
    );
  }

  if (state.status === 'denied') {
    return (
      <div className="card" style={{ padding: 28, borderRadius: 20, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Admin access required</h2>
        <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14 }}>
          You are signed in as <code className="mn">{state.email ?? 'a non-admin account'}</code>, which does not have admin privileges. Sign in with
          your admin email to continue.
        </p>
        <div>
          <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className="btn key">
            Switch account
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="card" style={{ padding: 28, borderRadius: 20 }}>
        <p style={{ margin: 0, color: 'var(--vg-red)' }}>{state.message}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 26, borderRadius: 20, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--vg-green)', display: 'inline-block' }} />
        <strong>Signed in as Admin ({state.email})</strong>
        <span className="mn" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--vg-raised)', color: 'var(--vg-sand)' }}>
          PREVIEW_MODE (No DATABASE_URL)
        </span>
      </div>
      <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.6 }}>
        Your admin authentication works! To save upstream providers, encrypted multi-key pools (Google / You.com / SevenAPI), models, and user
        credits, connect a Postgres database by adding <code className="mn">DATABASE_URL</code> in{' '}
        <strong>Vercel → Settings → Environment Variables</strong> and redeploying.
      </p>
      <div style={{ padding: 14, borderRadius: 12, background: 'var(--vg-bg2)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.7 }}>
        <div>DATABASE_URL=postgres://user:pass@host:5432/vigas?sslmode=require</div>
        <div>GATEWAY_URL=https://api.vigas.ai</div>
        <div>INTERNAL_SERVICE_TOKEN=your-random-32-char-secret</div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--vg-ink3)' }}>
        Tip: You can copy the Postgres connection string directly from your Supabase project (<strong>Project Settings → Database → Connection
        string → URI</strong>) or Neon. Tables (<code className="mn">upstream_providers</code>, <code className="mn">upstream_keys</code>) are
        created automatically on first visit.
      </p>
    </div>
  );
}
