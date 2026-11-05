import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { timeAgo } from '@vigas/core';
import { getModels, getRecentSessions } from '@/lib/data';
import { Icon, OrgMark } from '../ui';

const ago = (t: string) => (t === 'now' ? 'just now' : `${t} ago`);

const SOURCE: Record<string, string> = { api: 'API', chat: 'Vigas Chat', arena: 'Arena battle', retrobuild: 'RetroBuild' };

/** Latest requests across Vigas, anonymized. Re-rendered at most every 30 seconds. */
export async function LiveSessions() {
  'use cache';
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag('sessions');
  const [sessions, models] = await Promise.all([getRecentSessions(), getModels()]);
  const byId = new Map(models.map((m) => [m.id, m]));
  const now = new Date();
  return (
    <>
      {sessions.length === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vg-ink2)', padding: '12px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}>
          No sessions in the last 24 hours yet. Start one in Vigas Chat or the Arena.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sessions.map((s, i) => {
            const m = byId.get(s.modelId);
            const fresh = now.getTime() - new Date(s.createdAt).getTime() < 60_000;
            return (
              <li
                key={`${s.createdAt}${i}`}
                style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}
              >
                <OrgMark org={m?.org ?? '?'} size={28} radius={8} fontSize={14} ring={false} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m?.name ?? s.modelId}</b>
                  <span style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {SOURCE[s.source] ?? s.source} · {ago(timeAgo(s.createdAt, now))}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: s.status === 'ok' ? 'var(--vg-ink2)' : 'var(--vg-red)' }}>
                  {s.status === 'ok' ? (
                    fresh ? <span className="spin" aria-hidden="true" /> : <Icon name="check" size={15} style={{ color: 'var(--vg-green)' }} />
                  ) : (
                    <Icon name="x" size={15} />
                  )}
                  {s.status === 'ok' ? `${(s.latencyMs / 1000).toFixed(1)} s` : 'Failed'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/chat?mode=arena" className="btn gh" style={{ width: '100%', marginTop: 10 }}>
        Join the Arena — vote blind
      </Link>
    </>
  );
}

export function LiveSessionsFallback() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--vg-raised)' }} />
          <span style={{ height: 10, width: `${70 - i * 10}%`, borderRadius: 4, background: 'var(--vg-raised)' }} />
        </div>
      ))}
    </div>
  );
}
