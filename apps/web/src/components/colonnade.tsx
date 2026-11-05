import Link from 'next/link';
import type { LeaderboardEntry } from '@vigas/core';

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export const shortName = (name: string) => name.replace(/ \(.*\)$/, '');

/** Fill colours by rank: first is signal orange, then sand, then stone. */
export function pillarTone(i: number) {
  if (i === 0) return { fill: 'var(--vg-orange)', groove: 'var(--vg-orange-deep)', vc: 'var(--vg-orange)' };
  if (i < 3) return { fill: 'var(--vg-sand)', groove: 'var(--vg-sand-deep)', vc: 'var(--vg-sand)' };
  return { fill: 'var(--vg-pillar)', groove: '#2A2724', vc: 'var(--vg-ink2)' };
}

/** "The colonnade": win share drawn as classical pillars. */
export function Colonnade({ entries, maxHeight = 230 }: { entries: LeaderboardEntry[]; maxHeight?: number }) {
  const max = Math.max(...entries.map((e) => e.winRate), 1);
  return (
    <ol
      aria-label="Top models by win share"
      style={{ listStyle: 'none', margin: '26px 0 0', padding: 0, display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px,1.2vw,10px)', flex: 1, minHeight: 340 }}
    >
      {entries.map((a, i) => {
        const t = pillarTone(i);
        const h = Math.max(12, Math.round((a.winRate / max) * maxHeight));
        return (
          <li key={a.modelId} style={{ flex: '1 1 0', minWidth: 0 }}>
            <Link
              href="/leaderboard"
              title={`${shortName(a.name)} · ${a.winRate.toFixed(2)}% win share`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--vg-ink)' }}
            >
              <span className="mn" style={{ fontSize: 12, color: t.vc }}>
                {a.winRate.toFixed(2)}%
              </span>
              <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>
                <span style={{ display: 'block', width: '86%', height: 7, borderRadius: 2, background: t.fill }} />
                <span
                  style={{
                    display: 'block',
                    width: '62%',
                    height: h,
                    background: `repeating-linear-gradient(90deg,${t.fill} 0 6px,${t.groove} 6px 7px)`,
                  }}
                />
                <span style={{ display: 'block', width: '94%', height: 7, borderRadius: 2, background: t.fill }} />
              </span>
              <span className="sf" aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, color: t.vc }}>
                {ROMAN[i]}
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.25, textAlign: 'center', color: 'var(--vg-ink2)', minHeight: 30, overflowWrap: 'anywhere' }}>
                <span className="sr-only">Rank {i + 1}: </span>
                {shortName(a.name)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
