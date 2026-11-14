import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { Suspense } from 'react';
import { LEADERBOARD_CATEGORIES, formatUsd, type LeaderboardCategory } from '@vigas/core';
import { orgMark } from '@vigas/tokens';
import { LogoMark, Mark } from '@/components/ui';
import { getLeaderboardData } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Vigas AI Leaderboard Embed',
  robots: { index: false, follow: true },
};

const isCat = (v: string | undefined): v is LeaderboardCategory =>
  Boolean(v && LEADERBOARD_CATEGORIES.some((c) => c.id === v));

export default function EmbedLeaderboardPage({ searchParams }: PageProps<'/embed/leaderboard'>) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--vg-bg)', padding: 12, display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<EmbedSkeleton />}>
        <EmbedLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EmbedLoader({ searchParams }: Pick<PageProps<'/embed/leaderboard'>, 'searchParams'>) {
  const sp = await searchParams;
  const raw = typeof sp.category === 'string' ? sp.category.toLowerCase() : 'overall';
  const category: LeaderboardCategory = isCat(raw) ? raw : 'overall';
  return <EmbedBoard category={category} />;
}

async function EmbedBoard({ category }: { category: LeaderboardCategory }) {
  'use cache';
  cacheLife('content');
  cacheTag('leaderboard', `leaderboard:${category}`);

  const board = await getLeaderboardData(category);
  const label = LEADERBOARD_CATEGORIES.find((c) => c.id === category)?.label ?? 'Overall';
  const top = board.entries.slice(0, 8);
  const max = Math.max(...top.map((e) => e.winRate), 1);
  const boardHref = category === 'overall' ? '/leaderboard' : `/leaderboard/${category}`;

  return (
    <div className="card" style={{ borderRadius: 18, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--vg-line)', background: 'var(--vg-bg2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <LogoMark size={20} />
          <span className="sf" style={{ fontSize: 20, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Vigas <em className="hi">{label}</em>
          </span>
        </div>
        <span className="mn" style={{ fontSize: 11, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span className="led" />
          LIVE ARENA
        </span>
      </header>

      <div style={{ flex: 1 }}>
        {top.map((e) => {
          const mk = orgMark(e.org);
          const pct = Math.round((e.winRate / max) * 100);
          return (
            <div
              key={e.modelId}
              style={{
                display: 'grid',
                gridTemplateColumns: '26px 26px minmax(0,1fr) 76px 56px',
                gap: 8,
                alignItems: 'center',
                padding: '9px 14px',
                borderTop: '1px solid rgba(239,234,225,.06)',
                fontSize: 13,
              }}
            >
              <span className="mn" style={{ fontWeight: 600, color: e.rank <= 3 ? 'var(--vg-orange)' : 'var(--vg-ink3)' }}>
                #{e.rank}
              </span>
              <Mark color={mk.color} letter={mk.letter} size={26} radius={7} fontSize={13} ring={false} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                <div aria-hidden="true" style={{ height: 3, borderRadius: 2, background: 'var(--vg-raised)', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: e.rank === 1 ? 'var(--vg-orange)' : e.rank <= 3 ? 'var(--vg-sand)' : 'var(--vg-blue)' }} />
                </div>
              </div>
              <span className="mn" style={{ textAlign: 'right', fontSize: 12 }}>
                {e.winRate.toFixed(1)}%
              </span>
              <span className="mn" style={{ textAlign: 'right', fontSize: 12, color: 'var(--vg-ink2)' }}>
                {formatUsd(e.costPerTaskMicros)}
              </span>
            </div>
          );
        })}
      </div>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--vg-line)', background: 'var(--vg-bg2)', fontSize: 12 }}>
        <span className="mn" style={{ color: 'var(--vg-ink3)' }}>
          {board.totalSessions.toLocaleString('en-US')} sessions
        </span>
        <Link href={boardHref} target="_blank" rel="noopener" style={{ color: 'var(--vg-orange-text)', fontWeight: 500 }}>
          View full leaderboard on Vigas →
        </Link>
      </footer>
    </div>
  );
}

function EmbedSkeleton() {
  return (
    <div className="card" style={{ borderRadius: 18, padding: 16, flex: 1 }}>
      <div style={{ height: 18, width: 160, borderRadius: 6, background: 'var(--vg-raised)', marginBottom: 14 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 32, borderRadius: 8, background: 'var(--vg-bg2)', marginBottom: 8 }} />
      ))}
    </div>
  );
}
