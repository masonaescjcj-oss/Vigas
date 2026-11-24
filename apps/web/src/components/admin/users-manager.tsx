'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@vigas/db';
import { adminFetch } from '@/lib/client/admin-fetch';

export function UsersManager({ initialUsers, currentUserId }: { initialUsers: AdminUserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [customUsd, setCustomUsd] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(q = search) {
    const res = await adminFetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setError(d.error?.message ?? 'Could not load users.');
      return;
    }
    const data = (await res.json()) as { users: AdminUserRow[] };
    setUsers(data.users);
  }

  async function grant(u: AdminUserRow, deltaUsd: number, kind: 'promo' | 'adjustment' = 'promo') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'credits',
          accountId: u.accountId,
          deltaUsd,
          kind,
          reference: `admin:${kind}:${deltaUsd > 0 ? '+' : ''}$${deltaUsd}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { balanceUsd?: number; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not adjust credits.');
        return;
      }
      await refresh();
      setNotice(`Updated ${u.email} by ${deltaUsd > 0 ? '+' : ''}$${deltaUsd.toFixed(2)} → balance $${(data.balanceUsd ?? 0).toFixed(2)}.`);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(u: AdminUserRow) {
    const next = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${u.email} role to "${next}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'role', userId: u.id, role: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not change role.');
        return;
      }
      await refresh();
      setNotice(`Role for ${u.email} is now "${next}".`);
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(email: string, keyId: string, label: string) {
    if (!confirm(`Revoke API key "${label}" for ${email}?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_key', keyId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not revoke API key.');
        return;
      }
      await refresh();
      setNotice(`Revoked API key "${label}" for ${email}.`);
    } finally {
      setBusy(false);
    }
  }

  function applyCustom(u: AdminUserRow) {
    const n = Number(customUsd[u.id]);
    if (Number.isFinite(n) && n !== 0) {
      setCustomUsd((prev) => ({ ...prev, [u.id]: '' }));
      void grant(u, n, n > 0 ? 'promo' : 'adjustment');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {notice && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-green-edge)', color: 'var(--vg-green)', fontSize: 13.5 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-red-edge)', color: 'var(--vg-red)', fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 16, borderRadius: 20, display: 'grid', gap: 14 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void refresh(search);
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            className="adm-input"
            style={{ flex: '1 1 200px' }}
            placeholder="Search user by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn gh" style={{ minHeight: 40, padding: '0 14px' }}>
            Search
          </button>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {users.length} user(s)
          </span>
        </form>

        {users.length === 0 ? (
          <p style={{ margin: '6px 0', color: 'var(--vg-ink3)', fontSize: 14 }}>
            No users loaded yet (or waiting for Postgres connection).
          </p>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="adm-desktop" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 840 }}>
                <thead>
                  <tr className="mn" style={{ textAlign: 'left', color: 'var(--vg-ink3)', borderBottom: '1px solid var(--vg-line)' }}>
                    <th style={{ padding: '8px 10px' }}>User &amp; API Keys</th>
                    <th style={{ padding: '8px 10px' }}>Role</th>
                    <th style={{ padding: '8px 10px' }}>Balance</th>
                    <th style={{ padding: '8px 10px' }}>Deposits</th>
                    <th style={{ padding: '8px 10px' }}>Requests</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credits &amp; Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--vg-line)' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 500 }}>{u.email}</div>
                        {u.name && <div style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>{u.name}</div>}
                        {u.apiKeys.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                            {u.apiKeys.map((k) => (
                              <span key={k.id} className="mn adm-ep-pill">
                                <span>{k.name}</span>
                                <span style={{ color: 'var(--vg-ink3)' }}>({k.display})</span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => revokeKey(u.email, k.id, k.name)}
                                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--vg-red)', padding: 0, fontSize: 11 }}
                                >
                                  revoke
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="mn" style={{ padding: '10px' }}>
                        <span className={`adm-pill ${u.role === 'admin' ? 'indigo' : 'subtle'}`}>{u.role}</span>
                      </td>
                      <td className="mn" style={{ padding: '10px', fontWeight: 600 }}>
                        ${u.balanceUsd.toFixed(2)}
                      </td>
                      <td className="mn" style={{ padding: '10px', color: 'var(--vg-ink2)' }}>
                        ${u.lifetimeTopupUsd.toFixed(2)}
                      </td>
                      <td className="mn" style={{ padding: '10px', color: 'var(--vg-ink2)' }}>
                        {u.requests}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="chip" style={{ marginRight: 5 }} onClick={() => grant(u, 5, 'promo')} disabled={busy}>
                          +$5
                        </button>
                        <button type="button" className="chip" style={{ marginRight: 5 }} onClick={() => grant(u, 50, 'promo')} disabled={busy}>
                          +$50
                        </button>
                        <input
                          type="number"
                          step="1"
                          placeholder="±USD"
                          value={customUsd[u.id] ?? ''}
                          onChange={(e) => setCustomUsd((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          style={{
                            width: 72,
                            padding: '4px 7px',
                            borderRadius: 8,
                            border: '1px solid var(--vg-line2)',
                            background: 'var(--vg-bg)',
                            color: 'var(--vg-ink)',
                            fontSize: 12,
                            marginRight: 4,
                          }}
                        />
                        <button
                          type="button"
                          className="chip"
                          style={{ marginRight: 5 }}
                          disabled={busy || !customUsd[u.id]}
                          onClick={() => applyCustom(u)}
                        >
                          Apply
                        </button>
                        {u.id !== currentUserId && (
                          <button type="button" className="chip" onClick={() => toggleRole(u)} disabled={busy}>
                            {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked User Cards */}
            <div className="adm-mobile-list">
              {users.map((u) => (
                <div key={u.id} className="adm-key-card">
                  <div className="adm-mcard-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{u.email}</div>
                      {u.name && <div style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>{u.name}</div>}
                    </div>
                    <span className={`adm-pill ${u.role === 'admin' ? 'indigo' : 'subtle'}`}>{u.role}</span>
                  </div>

                  <div className="adm-user-stats">
                    <div>
                      <span className="lbl" style={{ fontSize: 10 }}>
                        Balance
                      </span>
                      <div className="mn" style={{ fontWeight: 600, fontSize: 14 }}>
                        ${u.balanceUsd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="lbl" style={{ fontSize: 10 }}>
                        Deposits
                      </span>
                      <div className="mn" style={{ fontSize: 13.5, color: 'var(--vg-ink2)' }}>
                        ${u.lifetimeTopupUsd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="lbl" style={{ fontSize: 10 }}>
                        Requests
                      </span>
                      <div className="mn" style={{ fontSize: 13.5, color: 'var(--vg-ink2)' }}>
                        {u.requests}
                      </div>
                    </div>
                  </div>

                  {u.apiKeys.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {u.apiKeys.map((k) => (
                        <span key={k.id} className="mn adm-ep-pill">
                          <span>{k.name}</span>
                          <span style={{ color: 'var(--vg-ink3)' }}>{k.display}</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => revokeKey(u.email, k.id, k.name)}
                            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--vg-red)', padding: '0 2px', fontSize: 11.5 }}
                          >
                            revoke
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn key"
                      style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5 }}
                      onClick={() => grant(u, 5, 'promo')}
                      disabled={busy}
                    >
                      +$5
                    </button>
                    <button
                      type="button"
                      className="btn gh"
                      style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5 }}
                      onClick={() => grant(u, 50, 'promo')}
                      disabled={busy}
                    >
                      +$50
                    </button>
                    <input
                      type="number"
                      step="1"
                      placeholder="±USD"
                      value={customUsd[u.id] ?? ''}
                      onChange={(e) => setCustomUsd((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      className="adm-input mn"
                      style={{ width: 80, padding: '6px 8px', fontSize: 12.5 }}
                    />
                    <button
                      type="button"
                      className="btn gh"
                      style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5 }}
                      disabled={busy || !customUsd[u.id]}
                      onClick={() => applyCustom(u)}
                    >
                      Apply
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        type="button"
                        className="btn gh"
                        style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5, marginLeft: 'auto' }}
                        onClick={() => toggleRole(u)}
                        disabled={busy}
                      >
                        {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
