import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import type { ReactNode } from 'react';
import { LEADERBOARD_CATEGORIES, formatUsd, paretoFrontier, timeAgo, type LeaderboardCategory } from '@vigas/core';
import { orgMark } from '@vigas/tokens';
import { getLeaderboardData } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd } from '@/lib/seo';
import { pillarTone, ROMAN, shortName } from '../colonnade';
import { Breadcrumb, Icon, JsonLd, Mark, type IconName } from '../ui';
import { RankingTable } from './ranking-table';

export const CATEGORY_ICON: Record<LeaderboardCategory, IconName> = {
  overall: 'spark',
  coding: 'code',
  webdev: 'globe',
  text: 'text',
  vision: 'eye',
  'image-edit': 'grid',
  aligned: 'shield',
  work: 'briefcase',
};

export const categoryPath = (id: LeaderboardCategory) => (id === 'overall' ? '/leaderboard' : `/leaderboard/${id}`);
export const categoryLabel = (id: LeaderboardCategory) => LEADERBOARD_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** The whole leaderboard page body for one category. `live` is request-time content passed through. */
export async function LeaderboardView({ category, live }: { category: LeaderboardCategory; live: ReactNode }) {
  'use cache';
  cacheLife('content');
  cacheTag('leaderboard', `leaderboard:${category}`);

  const board = await getLeaderboardData(category);
  const label = categoryLabel(category);
  const path = categoryPath(category);
  const now = new Date();
  const entries = board.entries.map((e) => ({ ...e, ...orgMark(e.org) }));
  const top3 = entries.slice(0, 3);
  // DOM order is rank order; CSS `order` puts first place in the middle.
  const podium = top3;
  const risers = [...entries]
    .map((e) => ({ e, delta: e.trend.length > 1 ? e.trend[e.trend.length - 1]! - e.trend[0]! : 0 }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  // Pareto chart: score vs cost per task, log-scaled cost.
  const pts = entries.filter((e) => e.costPerTaskMicros > 0);
  const costs = pts.map((e) => e.costPerTaskMicros);
  const scores = pts.map((e) => e.rating);
  const cMin = Math.min(...costs) * 0.8;
  const cMax = Math.max(...costs) * 1.25;
  const sMin = Math.floor((Math.min(...scores) - 10) / 10) * 10;
  const sMax = Math.ceil((Math.max(...scores) + 10) / 10) * 10;
  const lx = (c: number) => ((Math.log10(c) - Math.log10(cMin)) / (Math.log10(cMax) - Math.log10(cMin))) * 100;
  const ly = (s: number) => (1 - (s - sMin) / (sMax - sMin)) * 100;
  const frontier = paretoFrontier(pts.map((e) => ({ id: e.modelId, name: e.name, cost: e.costPerTaskMicros, score: e.rating })));
  const onFrontier = new Set(frontier.map((f) => f.id));
  const best = frontier[frontier.length - 1];

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label} AI leaderboard`,
    url: absoluteUrl(path),
    numberOfItems: entries.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: entries.map((e) => ({
      '@type': 'ListItem',
      position: e.rank,
      name: e.name,
      description: `${e.org} · ${e.winRate.toFixed(2)}% win share · score ${Math.round(e.rating)} · ${formatUsd(e.costPerTaskMicros)} per task`,
    })),
  };
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Leaderboard', path: '/leaderboard' },
    ...(category === 'overall' ? [] : [{ name: label, path }]),
  ];

  return (
    <>
      <JsonLd data={[breadcrumbLd(crumbs), itemList]} />
      <Breadcrumb
        items={[
          { name: 'Home', href: '/' },
          { name: 'Leaderboard', href: category === 'overall' ? undefined : '/leaderboard' },
          ...(category === 'overall' ? [] : [{ name: label }]),
        ]}
        style={{ paddingTop: 28 }}
      />

      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 48, padding: '22px 0 40px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1.2 1 520px', minWidth: 0 }}>
          <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="led" />
            Vigas Arena · updated {timeAgo(board.updatedAt, now) === 'now' ? 'just now' : `${timeAgo(board.updatedAt, now)} ago`}
          </div>
          <h1 className="sf" style={{ fontSize: 'clamp(48px,6.4vw,92px)', lineHeight: 0.96, letterSpacing: '-.032em', margin: '16px 0 18px' }}>
            {category === 'overall' ? (
              <>
                Measuring AI
                <br />
                in the <em className="hi">real world.</em>
              </>
            ) : (
              <>
                The best {label} models,
                <br />
                <em className="hi">ranked by real use.</em>
              </>
            )}
          </h1>
          <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 560, margin: 0 }}>
            Rankings built from real people doing real work on Vigas — every session, every blind vote, every dollar spent.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <b className="mn" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>
                {board.totalSessions.toLocaleString('en-US')}
              </b>
              <span style={{ color: 'var(--vg-ink2)', fontSize: 14 }}>sessions ranked</span>
            </span>
            <a href="#method" className="link-arrow">
              How we rank →
            </a>
          </div>
        </div>
        <div className="card" style={{ flex: '1 1 380px', minWidth: 0, padding: '20px 22px' }}>
          <h2 className="lbl" style={{ margin: '0 0 6px' }}>
            Rising this week · {label}
          </h2>
          {risers.map(({ e, delta }) => (
            <Link
              key={e.modelId}
              href={`/chat?model=${encodeURIComponent(e.modelId)}`}
              className="hov"
              style={{
                display: 'grid',
                gridTemplateColumns: '38px minmax(0,1fr) 18px',
                gap: 12,
                alignItems: 'center',
                padding: '12px 6px',
                margin: '0 -6px',
                borderRadius: 10,
                borderTop: '1px solid rgba(239,234,225,.06)',
              }}
            >
              <Mark color={e.color} letter={e.letter} size={38} radius={11} fontSize={18} ring={false} />
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName(e.name)}</b>
                <span style={{ fontSize: 13, color: 'var(--vg-ink2)' }}>
                  {delta >= 0 ? 'up' : 'down'} {Math.abs(delta).toFixed(2)} pts · <b style={{ color: 'var(--vg-sand)', fontWeight: 500 }}>#{e.rank}</b> in {label}
                </span>
              </span>
              <Icon name="chevRight" size={16} style={{ color: 'var(--vg-ink3)' }} />
            </Link>
          ))}
        </div>
      </header>

      <nav aria-label="Leaderboard category" className="scroll-x" style={{ display: 'flex', gap: 6, padding: '4px 0 6px' }}>
        {LEADERBOARD_CATEGORIES.map((c) => (
          <Link key={c.id} href={categoryPath(c.id)} className="tab" aria-current={c.id === category ? 'page' : undefined}>
            <Icon name={CATEGORY_ICON[c.id]} size={15} />
            {c.label}
          </Link>
        ))}
      </nav>

      <section
        aria-labelledby="podium"
        style={{
          margin: '20px 0 16px',
          background: 'var(--vg-surface)',
          border: '1px solid var(--vg-line)',
          borderRadius: 26,
          padding: 'clamp(20px,3vw,40px) clamp(14px,3vw,40px) 0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(239,234,225,.09) 1px,transparent 1.3px)',
            backgroundSize: '22px 22px',
            WebkitMaskImage: 'linear-gradient(#000,transparent 70%)',
            maskImage: 'linear-gradient(#000,transparent 70%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <h2 id="podium" className="sf" style={{ fontSize: 'clamp(30px,3vw,40px)', margin: 0, letterSpacing: '-.016em' }}>
            The podium · <em className="hi">{label}</em>
          </h2>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            Win share · this week
          </span>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(10px,2.4vw,32px)' }}>
          {podium.map((p) => {
            const i = p.rank - 1;
            const t = pillarTone(i);
            return (
              <li key={p.modelId} className="podium-col" style={{ order: i === 1 ? 0 : i === 0 ? 1 : 2 }}>
                <Mark color={p.color} letter={p.letter} size={46} radius={13} fontSize={22} />
                <b className="sf" style={{ fontSize: 'clamp(18px,2vw,26px)', fontWeight: 400, lineHeight: 1.1, marginTop: 10 }}>
                  <span className="sr-only">Rank {p.rank}: </span>
                  {shortName(p.name)}
                </b>
                <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 2 }}>
                  {p.org} · {Math.round(p.rating)} score
                </span>
                <span className="sf" style={{ fontSize: 'clamp(34px,3.6vw,52px)', lineHeight: 1, margin: '10px 0 14px', color: t.vc }}>
                  {p.winRate.toFixed(2)}%
                </span>
                <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 3 }}>
                  <span style={{ display: 'block', width: '84%', height: 12, borderRadius: 3, background: t.fill }} />
                  <span style={{ display: 'block', width: '92%', height: 6, borderRadius: 2, background: t.fill, opacity: 0.7 }} />
                  <span
                    style={{
                      display: 'block',
                      width: '64%',
                      height: [220, 160, 120][i] ?? 100,
                      background: `repeating-linear-gradient(90deg,${t.fill} 0 10px,${t.groove} 10px 12px)`,
                    }}
                  />
                </span>
                <span
                  aria-hidden="true"
                  style={{ display: 'grid', placeItems: 'center', width: '100%', height: 64, background: 'var(--vg-raised)', borderTop: '1px solid var(--vg-line2)', borderRadius: '6px 6px 0 0' }}
                >
                  <span className="sf" style={{ fontSize: 34, lineHeight: 1, color: t.vc }}>
                    {ROMAN[i]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Rankings" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', paddingBottom: 72 }}>
        <RankingTable entries={entries} category={category} categoryLabel={label} />

        <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderRadius: 22, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 className="sf" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
                Pareto frontier
              </h2>
              <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                score vs $/task
              </span>
            </div>
            <p style={{ margin: '6px 0 14px', fontSize: 13, color: 'var(--vg-ink2)' }}>
              Green models give the best score for their price. Everything below the line is beaten by something cheaper.
            </p>
            <div
              role="img"
              aria-label={`Pareto frontier: ${frontier.map((f) => shortName(f.name)).join(', ')} give the best score for their cost.`}
              style={{ position: 'relative', height: 260, marginLeft: 34, marginBottom: 22, borderLeft: '1px solid var(--vg-line2)', borderBottom: '1px solid var(--vg-line2)' }}
            >
              <div
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(239,234,225,.06) 1px,transparent 1px)', backgroundSize: '100% 25%' }}
              />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
                <polyline
                  points={frontier.map((f) => `${lx(f.cost).toFixed(1)},${ly(f.score).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke="var(--vg-green)"
                  style={{ strokeWidth: 1.5, strokeDasharray: '4 4', vectorEffect: 'non-scaling-stroke' }}
                />
              </svg>
              {pts.map((e) => {
                const on = onFrontier.has(e.modelId);
                const s = on ? 11 : 8;
                return (
                  <span
                    key={e.modelId}
                    title={`${e.name} · ${Math.round(e.rating)} · ${formatUsd(e.costPerTaskMicros)}/task`}
                    style={{
                      position: 'absolute',
                      left: `${lx(e.costPerTaskMicros).toFixed(1)}%`,
                      top: `${ly(e.rating).toFixed(1)}%`,
                      width: s,
                      height: s,
                      margin: `${-s / 2}px 0 0 ${-s / 2}px`,
                      borderRadius: '50%',
                      background: on ? 'var(--vg-green)' : 'var(--vg-ink3)',
                    }}
                  />
                );
              })}
              <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: -34, top: -7, fontSize: 12, color: 'var(--vg-ink3)' }}>
                {sMax}
              </span>
              <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: -34, bottom: -7, fontSize: 12, color: 'var(--vg-ink3)' }}>
                {sMin}
              </span>
              <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: -22, fontSize: 12, color: 'var(--vg-ink3)' }}>
                {formatUsd(Math.round(cMin))}
              </span>
              <span className="mn" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: -22, fontSize: 12, color: 'var(--vg-ink3)' }}>
                {formatUsd(Math.round(cMax))}
              </span>
              {best && (
                <span aria-hidden="true" style={{ position: 'absolute', right: 4, top: 4, fontSize: 12, color: 'var(--vg-green)' }}>
                  {shortName(best.name)}
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 22, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <h2 className="sf" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
                Live sessions
              </h2>
              <span className="mn" style={{ fontSize: 12, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="led" />
                LIVE
              </span>
            </div>
            {live}
          </div>
        </div>
      </section>

      <section id="method" aria-labelledby="mh" style={{ padding: '0 0 96px', scrollMarginTop: 24 }}>
        <div className="lbl">§ Methodology</div>
        <h2 id="mh" className="sf" style={{ fontSize: 'clamp(36px,4vw,56px)', lineHeight: 1.02, letterSpacing: '-.022em', margin: '12px 0 28px' }}>
          How the rankings <em className="hi">are made.</em>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {[
            ['I', 'var(--vg-orange)', 'var(--vg-orange)', 'Real sessions, not benchmarks', 'Win share counts how often a model finishes real tasks that users accept — across chat, API and RetroBuild.'],
            ['II', 'var(--vg-sand)', 'var(--vg-sand)', 'Blind pairwise votes', 'In Arena, people compare two hidden models and vote. Scores use a Bradley–Terry model with 95% confidence intervals.'],
            ['III', 'var(--vg-ink3)', 'var(--vg-ink2)', 'Cost is part of the score', 'Every ranking shows dollars per completed task, so you can see who is best for the money — not just best.'],
          ].map(([n, border, color, t, d]) => (
            <div key={n} style={{ borderTop: `2px solid ${border}`, paddingTop: 18 }}>
              <span className="sf" aria-hidden="true" style={{ fontSize: 40, color, lineHeight: 1 }}>
                {n}
              </span>
              <h3 className="sf" style={{ fontSize: 26, margin: '10px 0 6px', fontWeight: 400 }}>
                {t}
              </h3>
              <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
