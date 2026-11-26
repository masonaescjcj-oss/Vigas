'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/client/admin-fetch';
import type { AdminDbHealth } from '@/lib/admin';
import { Icon } from '../ui';

interface Props {
  email: string;
  authVia: 'postgres' | 'supabase_bridge';
  initialDb: AdminDbHealth;
}

export function AdminDbBanner({ email, authVia, initialDb }: Props) {
  const [db, setDb] = useState<AdminDbHealth>(initialDb);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function recheck() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/session');
      const data = (await res.json().catch(() => null)) as {
        previewMode?: boolean;
        dbConnected?: boolean;
        dbCode?: string | null;
        dbError?: string | null;
      } | null;
      if (res.ok && data) {
        const next: AdminDbHealth = {
          previewMode: Boolean(data.previewMode),
          connected: Boolean(data.dbConnected),
          code: data.dbCode ?? undefined,
          message: data.dbError ?? undefined,
        };
        setDb(next);
        setMsg({
          ok: next.connected,
          text: next.connected
            ? 'Postgres connected! Reloading admin data…'
            : `Database still unreachable${next.code ? ` (${next.code})` : ''}${next.message ? `: ${next.message}` : ''}`,
        });
        if (next.connected) {
          window.location.reload();
        }
      } else {
        setMsg({ ok: false, text: 'Could not verify database status right now.' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function runBootstrap() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/bootstrap', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        schema?: string;
        error?: { code?: string; message?: string };
      } | null;
      if (res.ok && data?.ok) {
        setDb({ previewMode: false, connected: true });
        setMsg({
          ok: true,
          text: `Isolated "${data.schema ?? 'vigas'}" schema bootstrapped & seeded! Refreshing…`,
        });
        setTimeout(() => window.location.reload(), 650);
      } else {
        const code = data?.error?.code;
        setDb((prev) => ({
          ...prev,
          connected: false,
          code: code ?? prev.code,
          message: data?.error?.message ?? prev.message,
        }));
        setMsg({
          ok: false,
          text: `${code ? `[${code}] ` : ''}${data?.error?.message ?? 'Bootstrap failed.'}`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (db.connected) {
    return (
      <div
        className="adm-status-strip"
        style={{
          borderRadius: 16,
          border: '1px solid rgba(62, 227, 155, 0.28)',
          background: 'rgba(62, 227, 155, 0.08)',
          padding: '11px 18px',
        }}
      >
        <div className="adm-status-meta">
          <span className="led" aria-hidden="true" />
          <span className="mn" style={{ fontSize: 12, fontWeight: 700, color: 'var(--vg-green)', letterSpacing: '.08em' }}>
            DB
          </span>
          <span className="mn" style={{ fontSize: 12.5, color: 'var(--vg-ink2)' }}>
            vigas schema online · isolated · <b style={{ color: 'var(--vg-ink)', fontWeight: 600 }}>{email}</b>
          </span>
          {authVia === 'supabase_bridge' && <span className="adm-pill subtle">Supabase SSO</span>}
        </div>
        <div className="adm-status-actions">
          <button type="button" className="chip" onClick={runBootstrap} disabled={busy} style={{ minHeight: 30, padding: '0 12px', fontSize: 12, borderRadius: 999 }}>
            <Icon name="refresh" size={13} />
            {busy ? 'Syncing…' : 'Bootstrap schema'}
          </button>
        </div>
        {msg && (
          <p className="mn" style={{ width: '100%', margin: '4px 0 0', fontSize: 12, color: msg.ok ? 'var(--vg-green)' : 'var(--vg-red)' }}>
            {msg.text}
          </p>
        )}
      </div>
    );
  }

  const isAuthErr = db.code === '28P01';

  return (
    <div className="card adm-db-alert" role="status">
      <div className="adm-db-alert-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span className="led orange" aria-hidden="true" />
          <strong style={{ fontSize: 13.5 }}>{isAuthErr ? 'Postgres password mismatch (28P01)' : db.previewMode ? 'Database not linked' : 'Database offline'}</strong>
          <span className="adm-pill warn">{email}</span>
        </div>
        <div className="adm-db-alert-btns">
          <button type="button" className="btn gh" onClick={recheck} disabled={busy} style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5 }}>
            <Icon name="refresh" size={13} />
            {busy ? 'Checking…' : 'Test DB'}
          </button>
          {!db.previewMode && (
            <button type="button" className="btn key" onClick={runBootstrap} disabled={busy} style={{ minHeight: 34, padding: '0 12px', fontSize: 12.5 }}>
              <Icon name="bolt" size={13} />
              {busy ? 'Syncing…' : 'Bootstrap vigas'}
            </button>
          )}
        </div>
      </div>
      <p className="adm-db-alert-desc">
        {db.previewMode ? (
          <>
            Admin SSO is active. Set <code className="mn">DATABASE_URL</code> in Vercel to save providers, keys &amp; models inside <code className="mn">vigas.*</code>.
          </>
        ) : isAuthErr ? (
          <>
            Admin SSO verified. Update <code className="mn">DATABASE_URL</code> with the reset DB password in Vercel, redeploy, then tap <strong>Bootstrap vigas</strong> (isolated to <code className="mn">vigas.*</code>).
          </>
        ) : (
          <>
            Admin SSO verified, but Postgres is unreachable{db.message ? ` (${db.message})` : ''}. Update <code className="mn">DATABASE_URL</code> and tap <strong>Test DB</strong>.
          </>
        )}
      </p>
      {msg && (
        <div
          className="mn"
          style={{
            fontSize: 12.5,
            padding: '8px 12px',
            borderRadius: 10,
            background: msg.ok ? 'var(--vg-green-soft)' : 'var(--vg-red-soft)',
            border: `1px solid ${msg.ok ? 'var(--vg-green-edge)' : 'var(--vg-red-edge)'}`,
            color: msg.ok ? 'var(--vg-green)' : 'var(--vg-red)',
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
