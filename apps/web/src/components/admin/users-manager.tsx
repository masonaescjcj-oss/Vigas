'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@vigas/db';

export function UsersManager({ initialUsers, currentUserId }: { initialUsers: AdminUserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [customUsd, setCustomUsd] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(q = search) {
    const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { users: AdminUserRow[] };
    setUsers(data.users);
  }

  async function grant(u: AdminUserRow, deltaUsd: number, kind: 'promo' | 'adjustment' = 'promo') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/users', {
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
      const data = (await res.json()) as { balanceUsd?: number; error?: { message?: string } };
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
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'role', userId: u.id, role: next }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {notice && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-green)', color: 'var(--vg-green)', fontSize: 14 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-red)', color: 'var(--vg-red)', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 18, borderRadius: 20, display: 'grid', gap: 14 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void refresh(search);
          }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            style={{
              flex: '1 1 240px',
              padding: '9px 12px',
              borderRadius: 10,
              border: '1px solid var(--vg-line2)',
              background: 'var(--vg-bg)',
              color: 'var(--vg-ink)',
              fontSize: 14,
            }}
            placeholder="Search user by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn">
            Search
          </button>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {users.length} user(s)
          </span>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
            <thead>
              <tr className="mn" style={{ textAlign: 'left', color: 'var(--vg-ink3)', borderBottom: '1px solid var(--vg-line)' }}>
                <th style={{ padding: '8px 10px' }}>User</th>
                <th style={{ padding: '8px 10px' }}>Role</th>
                <th style={{ padding: '8px 10px' }}>Balance</th>
                <th style={{ padding: '8px 10px' }}>Deposits</th>
                <th style={{ padding: '8px 10px' }}>Requests</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credits & Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--vg-line)' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 500 }}>{u.email}</div>
                    {u.name && <div style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>{u.name}</div>}
                  </td>
                  <td className="mn" style={{ padding: '10px' }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'var(--vg-raised)',
                        color: u.role === 'admin' ? 'var(--vg-indigo)' : 'var(--vg-ink2)',
                      }}
                    >
                      {u.role}
                    </span>
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
                    <button type="button" className="chip" style={{ marginRight: 6 }} onClick={() => grant(u, 5, 'promo')} disabled={busy}>
                      +$5 Promo
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
                      style={{ marginRight: 6 }}
                      disabled={busy || !customUsd[u.id]}
                      onClick={() => {
                        const n = Number(customUsd[u.id]);
                        if (Number.isFinite(n) && n !== 0) {
                          setCustomUsd((prev) => ({ ...prev, [u.id]: '' }));
                          void grant(u, n, n > 0 ? 'promo' : 'adjustment');
                        }
                      }}
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
      </div>
    </div>
  );
}
