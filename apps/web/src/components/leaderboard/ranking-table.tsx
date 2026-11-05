'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { LeaderboardEntry } from '@vigas/core';
import { formatUsd } from '@/lib/fmt';
import { Icon, Mark } from '../ui';

type Row = LeaderboardEntry & { color: string; letter: string };
type SortKey = 'win' | 'score' | 'cost';

function spark(trend: number[]): { points: string; up: boolean } {
  if (trend.length < 2) return { points: '', up: true };
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const span = max - min || 1;
  const points = trend.map((v, i) => `${((i / (trend.length - 1)) * 76 + 2).toFixed(1)},${(21 - ((v - min) / span) * 18).toFixed(1)}`).join(' ');
  return { points, up: trend[trend.length - 1]! >= trend[0]! };
}

function csv(rows: Row[], category: string): string {
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const head = ['rank', 'model_id', 'name', 'org', 'win_share_pct', 'score', 'ci_95', 'usd_per_task', 'votes', 'category'];
  const body = rows.map((r) =>
    [r.rank, r.modelId, r.name, r.org, r.winRate, r.rating, r.ci, (r.costPerTaskMicros / 1_000_000).toFixed(4), r.votes, category].map(esc).join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function RankingTable({ entries, category, categoryLabel }: { entries: Row[]; category: string; categoryLabel: string }) {
  const [sort, setSort] = useState<SortKey>('win');
  const rows = useMemo(
    () =>
      [...entries].sort((a, b) =>
        sort === 'cost' ? a.costPerTaskMicros - b.costPerTaskMicros : sort === 'score' ? b.rating - a.rating : b.winRate - a.winRate,
      ),
    [entries, sort],
  );
  const max = Math.max(...entries.map((e) => e.winRate), 1);

  const download = () => {
    const blob = new Blob([csv(entries, category)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vigas-leaderboard-${category}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right', arrow: string) => (
    <th scope="col" aria-sort={sort === key ? (key === 'cost' ? 'ascending' : 'descending') : 'none'} style={{ ...th, textAlign: align }}>
      <button type="button" className="sortb" onClick={() => setSort(key)} style={{ color: sort === key ? 'var(--vg-ink)' : 'var(--vg-ink3)' }}>
        {label} {sort === key ? arrow : ''}
        <span className="sr-only">{sort === key ? '(sorted)' : '(sort by this column)'}</span>
      </button>
    </th>
  );

  return (
    <div className="card" style={{ flex: '2 1 640px', minWidth: 0, borderRadius: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', flexWrap: 'wrap' }}>
        <h2 className="sf" style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>
          Full ranking
        </h2>
        <button type="button" className="btn gh" onClick={download} style={{ minHeight: 36, padding: '0 12px', fontSize: 13, borderRadius: 9 }}>
          <Icon name="download" size={15} />
          CSV
        </button>
      </div>
      <div className="tablewrap">
        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
          <caption className="sr-only">{categoryLabel} leaderboard: win share, score, cost per task and votes</caption>
          <colgroup>
            <col style={{ width: 64 }} />
            <col />
            <col style={{ width: 190 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 106 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr className="mn" style={{ background: 'var(--vg-bg2)', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
              <th scope="col" style={{ ...th, textAlign: 'left' }}>
                #
              </th>
              <th scope="col" style={{ ...th, textAlign: 'left' }}>
                Model
              </th>
              {sortHeader('win', 'Win share', 'left', '↓')}
              {sortHeader('score', 'Score', 'right', '↓')}
              {sortHeader('cost', '$/task', 'right', '↑')}
              <th scope="col" style={{ ...th, textAlign: 'right' }}>
                Votes
              </th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>
                7 days
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const s = spark(a.trend);
              return (
                <tr key={a.modelId} className="hov" style={{ borderTop: '1px solid rgba(239,234,225,.06)' }}>
                  <td className="mn" style={{ ...td, fontSize: 14, fontWeight: 600, color: a.rank <= 3 ? 'var(--vg-orange)' : 'var(--vg-ink3)' }}>
                    {a.rank}
                  </td>
                  <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 400 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <Mark color={a.color} letter={a.letter} size={30} radius={9} fontSize={15} ring={false} />
                      <span style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</b>
                        <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                          {a.org}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td style={td}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                        <span
                          style={{
                            display: 'block',
                            height: '100%',
                            width: `${((a.winRate / max) * 100).toFixed(1)}%`,
                            background: a.rank === 1 ? 'var(--vg-orange)' : a.rank <= 3 ? 'var(--vg-sand)' : 'var(--vg-blue)',
                            borderRadius: 3,
                          }}
                        />
                      </span>
                      <span className="mn" style={{ fontSize: 13, width: 58, textAlign: 'right' }}>
                        {a.winRate.toFixed(2)}%
                      </span>
                    </span>
                  </td>
                  <td className="mn" style={{ ...td, fontSize: 13, textAlign: 'right' }}>
                    {Math.round(a.rating)} <span style={{ color: 'var(--vg-ink3)' }}>±{Math.round(a.ci)}</span>
                  </td>
                  <td className="mn" style={{ ...td, fontSize: 13, textAlign: 'right' }}>
                    {formatUsd(a.costPerTaskMicros)}
                  </td>
                  <td className="mn" style={{ ...td, fontSize: 13, textAlign: 'right', color: 'var(--vg-ink2)' }}>
                    {a.votes.toLocaleString('en-US')}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <svg viewBox="0 0 80 24" width="72" height="22" role="img" aria-label={`7-day trend ${s.up ? 'up' : 'down'}`} style={{ verticalAlign: 'middle' }}>
                      <polyline
                        points={s.points}
                        fill="none"
                        stroke={s.up ? 'var(--vg-green)' : 'var(--vg-red)'}
                        style={{ strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}
                      />
                    </svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: CSSProperties = { padding: '11px 20px', fontWeight: 500 };
const td: CSSProperties = { padding: '12px 20px', verticalAlign: 'middle' };
