import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { timeAgo } from '@vigas/core';
import { getModels, getRecentSessions } from '@/lib/data';
import { Icon, OrgMark } from '../ui';

const SOURCE_EN: Record<string, string> = { api: 'API', chat: 'Gateway session', arena: 'Eval run', retrobuild: 'Sandbox run' };
const SOURCE_FA: Record<string, string> = { api: 'API', chat: 'نشست گیت‌وی', arena: 'ارزیابی', retrobuild: 'اجرای سندباکس' };

function ago(t: string, isFa: boolean): string {
  if (!isFa) return t === 'now' ? 'just now' : `${t} ago`;
  if (t === 'now') return 'هم‌اکنون';
  const m = /^(\d+)\s*(min|m|h|d|w)$/i.exec(t);
  if (!m) return t;
  const units: Record<string, string> = { min: 'دقیقه پیش', m: 'دقیقه پیش', h: 'ساعت پیش', d: 'روز پیش', w: 'هفته پیش' };
  return `${m[1]} ${units[m[2]!.toLowerCase()] ?? ''}`.trim();
}

/** Latest requests across Vigas, anonymized. Re-rendered at most every 30 seconds. */
export async function LiveSessions({ lang = 'en' }: { lang?: 'en' | 'fa' } = {}) {
  'use cache';
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag('sessions');
  const isFa = lang === 'fa';
  const [sessions, models] = await Promise.all([getRecentSessions(), getModels()]);
  const byId = new Map(models.map((m) => [m.id, m]));
  const now = new Date();
  const SOURCE = isFa ? SOURCE_FA : SOURCE_EN;
  return (
    <>
      {sessions.length === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--vg-ink2)', padding: '12px 0', borderTop: '1px solid var(--vg-line-soft)' }}>
          {isFa ? 'هنوز نشستی در ۲۴ ساعت اخیر ثبت نشده است. یک درخواست از طریق API ویگاس بفرستید.' : 'No sessions in the last 24 hours yet. Send a request through the Vigas API.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sessions.map((s, i) => {
            const m = byId.get(s.modelId);
            const fresh = now.getTime() - new Date(s.createdAt).getTime() < 60_000;
            return (
              <li
                key={`${s.createdAt}${i}`}
                style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--vg-line-soft)' }}
              >
                <OrgMark org={m?.org ?? '?'} size={28} radius={8} fontSize={14} ring={false} />
                <span style={{ minWidth: 0 }}>
                  <b dir="ltr" style={{ display: 'block', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : 'left' }}>
                    {m?.name ?? s.modelId}
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {SOURCE[s.source] ?? s.source} · {ago(timeAgo(s.createdAt, now), isFa)}
                  </span>
                </span>
                <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: s.status === 'ok' ? 'var(--vg-ink2)' : 'var(--vg-red)' }}>
                  {s.status === 'ok' ? (
                    fresh ? <span className="spin" aria-hidden="true" /> : <Icon name="check" size={15} style={{ color: 'var(--vg-green)' }} />
                  ) : (
                    <Icon name="x" size={15} />
                  )}
                  {s.status === 'ok' ? `${(s.latencyMs / 1000).toFixed(1)} ${isFa ? 'ثانیه' : 's'}` : isFa ? 'ناموفق' : 'Failed'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/models#quickstart" className="btn gh" style={{ width: '100%', marginTop: 10 }}>
        {isFa ? 'اتصال با API — شروع در ۳۰ ثانیه' : 'Connect via API — start in 30s'}
      </Link>
    </>
  );
}

export function LiveSessionsFallback() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--vg-line-soft)' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--vg-raised)' }} />
          <span style={{ height: 10, width: `${70 - i * 10}%`, borderRadius: 4, background: 'var(--vg-raised)' }} />
        </div>
      ))}
    </div>
  );
}
