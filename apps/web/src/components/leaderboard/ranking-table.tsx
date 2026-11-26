'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import type { LeaderboardEntry } from '@vigas/core';
import { formatUsd } from '@/lib/fmt';
import { Icon, OrgMark } from '../ui';
import { EmbedModal } from './embed-modal';

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

export function RankingTable({
  entries,
  category,
  categoryLabel,
  siteUrl,
  lang = 'en',
}: {
  entries: Row[];
  category: string;
  categoryLabel: string;
  siteUrl: string;
  lang?: 'en' | 'fa';
}) {
  const [sort, setSort] = useState<SortKey>('win');
  const [embedOpen, setEmbedOpen] = useState(false);
  const isFa = lang === 'fa';

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

  const sortHeader = (key: SortKey, label: string, align: 'start' | 'end', arrow: string) => (
    <th scope="col" aria-sort={sort === key ? (key === 'cost' ? 'ascending' : 'descending') : 'none'} style={{ ...th, textAlign: align }}>
      <button type="button" className="sortb" onClick={() => setSort(key)} style={{ color: sort === key ? 'var(--vg-ink)' : 'var(--vg-ink3)' }}>
        {label} {sort === key ? arrow : ''}
        <span className="sr-only">{sort === key ? (isFa ? '(مرتب‌شده)' : '(sorted)') : isFa ? '(مرتب‌سازی با این ستون)' : '(sort by this column)'}</span>
      </button>
    </th>
  );

  return (
    <div className="card" style={{ flex: '2 1 640px', minWidth: 0, borderRadius: 22, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', flexWrap: 'wrap' }}>
        <h2 className="sf" style={{ fontSize: isFa ? 24 : 28, margin: 0, fontWeight: isFa ? 700 : 400 }}>
          {isFa ? 'رتبه‌بندی کامل' : 'Full ranking'}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn gh" onClick={() => setEmbedOpen(true)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13, borderRadius: 9 }}>
            <Icon name="code" size={15} />
            {isFa ? 'کد جاسازی' : 'Embed'}
          </button>
          <button type="button" className="btn gh" onClick={download} style={{ minHeight: 36, padding: '0 12px', fontSize: 13, borderRadius: 9 }}>
            <Icon name="download" size={15} />
            CSV
          </button>
        </div>
      </div>

      {/* Desktop & tablet table */}
      <div className="rt-desktop tablewrap">
        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
          <caption className="sr-only">
            {isFa ? `لیدربورد ${categoryLabel}: سهم برد، امتیاز، هزینه هر تسک و آرا` : `${categoryLabel} leaderboard: win share, score, cost per task and votes`}
          </caption>
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
            <tr className="mn" style={{ background: 'var(--vg-bg2)', fontSize: 12, color: 'var(--vg-ink3)', textTransform: isFa ? undefined : 'uppercase', letterSpacing: isFa ? 0 : '.07em' }}>
              <th scope="col" style={{ ...th, textAlign: 'start' }}>
                #
              </th>
              <th scope="col" style={{ ...th, textAlign: 'start' }}>
                {isFa ? 'مدل' : 'Model'}
              </th>
              {sortHeader('win', isFa ? 'سهم برد' : 'Win share', 'start', '↓')}
              {sortHeader('score', isFa ? 'امتیاز' : 'Score', 'end', '↓')}
              {sortHeader('cost', isFa ? '$/تسک' : '$/task', 'end', '↑')}
              <th scope="col" style={{ ...th, textAlign: 'end' }}>
                {isFa ? 'آرا' : 'Votes'}
              </th>
              <th scope="col" style={{ ...th, textAlign: 'end' }}>
                {isFa ? '۷ روز' : '7 days'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const s = spark(a.trend);
              const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][a.rank - 1] ?? String(a.rank);
              return (
                <tr key={a.modelId} className="hov" style={{ borderTop: '1px solid var(--vg-line)' }}>
                  <td
                    className="sf"
                    dir="ltr"
                    style={{
                      ...td,
                      textAlign: 'start',
                      fontSize: 21,
                      lineHeight: 1,
                      color: a.rank === 1 ? 'var(--vg-orange-text)' : a.rank <= 3 ? 'var(--vg-sand)' : 'var(--vg-ink3)',
                    }}
                  >
                    {roman}
                  </td>
                  <th scope="row" style={{ ...td, textAlign: 'start', fontWeight: 400 }}>
                    <Link href={`/models?q=${encodeURIComponent(a.modelId)}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, color: 'var(--vg-ink)' }}>
                      <OrgMark org={a.org} size={34} radius={10} fontSize={16} />
                      <span style={{ minWidth: 0 }}>
                        <b dir="ltr" style={{ display: 'block', fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : 'left' }}>
                          {a.name}
                        </b>
                        <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 11.5, color: 'var(--vg-ink3)', textAlign: isFa ? 'right' : 'left' }}>
                          {a.org}
                        </span>
                      </span>
                    </Link>
                  </th>
                  <td style={td}>
                    <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                        <span
                          className={a.rank === 1 ? 'bg-signal-grad' : undefined}
                          style={{
                            display: 'block',
                            height: '100%',
                            width: `${((a.winRate / max) * 100).toFixed(1)}%`,
                            background: a.rank === 1 ? undefined : a.rank <= 3 ? 'var(--vg-sand-fill)' : 'var(--vg-indigo)',
                            borderRadius: 999,
                          }}
                        />
                      </span>
                      <span className="mn" style={{ fontSize: 12.5, width: 58, textAlign: 'right', color: 'var(--vg-ink2)' }}>
                        {a.winRate.toFixed(2)}%
                      </span>
                    </span>
                  </td>
                  <td className="mn" dir="ltr" style={{ ...td, fontSize: 13, textAlign: isFa ? 'left' : 'right' }}>
                    {Math.round(a.rating)} <span style={{ color: 'var(--vg-ink3)' }}>±{Math.round(a.ci)}</span>
                  </td>
                  <td className="mn" dir="ltr" style={{ ...td, fontSize: 13, textAlign: isFa ? 'left' : 'right' }}>
                    {formatUsd(a.costPerTaskMicros)}
                  </td>
                  <td className="mn" dir="ltr" style={{ ...td, fontSize: 13, textAlign: isFa ? 'left' : 'right', color: 'var(--vg-ink2)' }}>
                    {a.votes.toLocaleString('en-US')}
                  </td>
                  <td style={{ ...td, textAlign: 'end' }}>
                    <svg viewBox="0 0 80 24" width="72" height="22" role="img" aria-label={isFa ? `روند ۷ روزه ${s.up ? 'صعودی' : 'نزولی'}` : `7-day trend ${s.up ? 'up' : 'down'}`} style={{ verticalAlign: 'middle' }}>
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

      {/* Zero-scroll mobile cards */}
      <div className="rt-mobile" style={{ borderTop: '1px solid var(--vg-line)' }}>
        <div role="group" aria-label={isFa ? 'مرتب‌سازی مدل‌ها' : 'Sort models'} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--vg-bg2)' }}>
          {(
            [
              ['win', isFa ? 'سهم برد ↓' : 'Win share ↓'],
              ['score', isFa ? 'امتیاز ↓' : 'Score ↓'],
              ['cost', isFa ? '$/تسک ↑' : '$/task ↑'],
            ] as Array<[SortKey, string]>
          ).map(([key, label]) => (
            <button key={key} type="button" className="chip" aria-pressed={sort === key} onClick={() => setSort(key)} style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>
        {rows.map((a) => (
          <div key={a.modelId} style={{ padding: '14px 16px', borderTop: '1px solid var(--vg-line-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mn" dir="ltr" style={{ width: 24, fontSize: 13, fontWeight: 600, color: a.rank <= 3 ? 'var(--vg-orange-text)' : 'var(--vg-ink3)', flexShrink: 0 }}>
                #{a.rank}
              </span>
              <OrgMark org={a.org} size={32} radius={9} fontSize={15} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/models?q=${encodeURIComponent(a.modelId)}`}
                  dir="ltr"
                  style={{ display: 'block', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--vg-ink)', textAlign: isFa ? 'right' : 'left' }}
                >
                  {a.name}
                </Link>
                <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', textAlign: isFa ? 'right' : 'left' }}>
                  {a.org}
                </span>
              </div>
              <span className="mn" dir="ltr" style={{ fontSize: 13, fontWeight: 600, color: a.rank === 1 ? 'var(--vg-orange-text)' : 'var(--vg-ink)' }}>
                {a.winRate.toFixed(2)}%
              </span>
            </div>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${((a.winRate / max) * 100).toFixed(1)}%`,
                    background: a.rank === 1 ? 'var(--vg-orange)' : a.rank <= 3 ? 'var(--vg-sand-fill)' : 'var(--vg-blue)',
                  }}
                />
              </span>
            </div>
            <div className="mn" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--vg-ink2)' }}>
              <span>
                {isFa ? 'امتیاز' : 'Score'} {Math.round(a.rating)} <span style={{ color: 'var(--vg-ink3)' }}>±{Math.round(a.ci)}</span>
              </span>
              <span dir="ltr">{formatUsd(a.costPerTaskMicros)}/{isFa ? 'تسک' : 'task'}</span>
              <span>
                {a.votes.toLocaleString('en-US')} {isFa ? 'رأی' : 'votes'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <EmbedModal
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        category={category}
        categoryLabel={categoryLabel}
        siteUrl={siteUrl}
        lang={lang}
      />
    </div>
  );
}

const th: CSSProperties = { padding: '11px 20px', fontWeight: 500 };
const td: CSSProperties = { padding: '12px 20px', verticalAlign: 'middle' };
