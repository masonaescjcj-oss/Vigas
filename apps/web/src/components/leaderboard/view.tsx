import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import type { CSSProperties, ReactNode } from 'react';
import { LEADERBOARD_CATEGORIES, formatUsd, paretoFrontier, timeAgo, type LeaderboardCategory } from '@vigas/core';
import { orgMark } from '@vigas/tokens';
import { getLeaderboardData } from '@/lib/data';
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/env';
import { breadcrumbLd, faqLd } from '@/lib/seo';
import { getLeaderboardFaq, LEADERBOARD_CATEGORIES_FA, LEADERBOARD_CATEGORY_SEO, LEADERBOARD_CATEGORY_SEO_FA } from '@/lib/seo-catalog';
import { pillarTone, ROMAN, shortName } from '../colonnade';
import { Breadcrumb, Icon, JsonLd, OrgMark, type IconName } from '../ui';
import { ParetoChart, type ParetoPoint } from './pareto-chart';
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
export const categoryLabel = (id: LeaderboardCategory, lang: 'en' | 'fa' = 'en') =>
  lang === 'fa' ? (LEADERBOARD_CATEGORIES_FA[id] ?? id) : (LEADERBOARD_CATEGORIES.find((c) => c.id === id)?.label ?? id);

function faAgo(t: string): string {
  if (t === 'now') return 'هم‌اکنون';
  const m = /^(\d+)\s*(min|m|h|d|w)$/i.exec(t);
  if (!m) return t;
  const units: Record<string, string> = { min: 'دقیقه پیش', m: 'دقیقه پیش', h: 'ساعت پیش', d: 'روز پیش', w: 'هفته پیش' };
  return `${m[1]} ${units[m[2]!.toLowerCase()] ?? ''}`.trim();
}

async function getCachedBoardPayload(category: LeaderboardCategory, lang: 'en' | 'fa') {
  'use cache';
  cacheLife('content');
  cacheTag('leaderboard', `leaderboard:${category}`);

  const isFa = lang === 'fa';
  const board = await getLeaderboardData(category);
  const label = categoryLabel(category, lang);
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
  const cMin = costs.length ? Math.min(...costs) * 0.8 : 1000;
  const cMax = costs.length ? Math.max(...costs) * 1.25 : 100_000;
  const sMin = scores.length ? Math.floor((Math.min(...scores) - 10) / 10) * 10 : 1200;
  const sMax = scores.length ? Math.ceil((Math.max(...scores) + 10) / 10) * 10 : 1600;
  const cDenom = Math.max(0.0001, Math.log10(cMax) - Math.log10(cMin));
  const sDenom = Math.max(1, sMax - sMin);
  const lx = (c: number) => ((Math.log10(c) - Math.log10(cMin)) / cDenom) * 100;
  const ly = (s: number) => (1 - (s - sMin) / sDenom) * 100;
  const frontier = paretoFrontier(pts.map((e) => ({ id: e.modelId, name: e.name, cost: e.costPerTaskMicros, score: e.rating })));
  const onFrontier = new Set(frontier.map((f) => f.id));
  const best = frontier[frontier.length - 1];
  const paretoPoints: ParetoPoint[] = pts.map((e) => ({
    modelId: e.modelId,
    name: e.name,
    org: e.org,
    rank: e.rank,
    winRate: e.winRate,
    rating: e.rating,
    costPerTaskMicros: e.costPerTaskMicros,
    onFrontier: onFrontier.has(e.modelId),
    xPct: lx(e.costPerTaskMicros),
    yPct: ly(e.rating),
  }));
  const frontierPolyline = frontier.map((f) => `${lx(f.cost).toFixed(1)},${ly(f.score).toFixed(1)}`).join(' ');

  const catSeo = (isFa ? LEADERBOARD_CATEGORY_SEO_FA : LEADERBOARD_CATEGORY_SEO)[category];
  const faqItems = getLeaderboardFaq(category, label, entries, lang);
  const pageUrl = absoluteUrl(path);
  const homeHref = isFa ? '/fa' : '/';
  const boardHomeLabel = isFa ? 'لیدربورد' : 'Leaderboard';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: isFa ? `لیدربورد هوش مصنوعی ${label}` : `${label} AI leaderboard`,
    url: pageUrl,
    numberOfItems: entries.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: entries.map((e) => ({
      '@type': 'ListItem',
      position: e.rank,
      name: e.name,
      url: absoluteUrl(`/models?q=${encodeURIComponent(e.modelId)}`),
      description: `${e.org} · ${e.winRate.toFixed(2)}% win share · score ${Math.round(e.rating)} · ${formatUsd(e.costPerTaskMicros)} per task`,
    })),
  };

  const datasetLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: isFa ? `رده‌بندی مدل‌ها و ایجنت‌های هوش مصنوعی ویگاس (${label})` : `Vigas ${label} AI Model & Agent Leaderboard`,
    description: `${catSeo.intro} Built from ${board.totalSessions.toLocaleString('en-US')} real gateway sessions and verified benchmarks.`,
    url: pageUrl,
    dateModified: board.updatedAt,
    inLanguage: lang,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL },
    variableMeasured: ['Win Share Percentage', 'Bradley-Terry ELO Score', 'Cost Per Completed Task (USD)', '95% Confidence Interval'],
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: pageUrl,
    },
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isFa ? `لیدربورد هوش مصنوعی ${label}` : `${label} AI Leaderboard`,
    url: pageUrl,
    inLanguage: lang,
    description: catSeo.intro,
    mainEntity: { '@type': 'ItemList', numberOfItems: entries.length },
  };

  const crumbs = [
    { name: isFa ? 'خانه' : 'Home', path: homeHref },
    { name: boardHomeLabel, path: '/leaderboard' },
    ...(category === 'overall' ? [] : [{ name: label, path }]),
  ];

  const agoText = timeAgo(board.updatedAt, now);
  const frontierNames = frontier.map((f) => shortName(f.name));

  return {
    isFa,
    board,
    label,
    entries,
    podium,
    risers,
    cMin,
    cMax,
    sMin,
    sMax,
    bestId: best?.id ?? null,
    paretoPoints,
    frontierPolyline,
    frontierNames,
    catSeo,
    faqItems,
    homeHref,
    boardHomeLabel,
    itemList,
    datasetLd,
    collectionLd,
    crumbs,
    agoText,
  };
}

/** The whole leaderboard page body for one category. `live` is request-time content passed through. */
export async function LeaderboardView({
  category,
  live,
  lang = 'en',
}: {
  category: LeaderboardCategory;
  live: ReactNode;
  lang?: 'en' | 'fa';
}) {
  const {
    isFa,
    board,
    label,
    entries,
    podium,
    risers,
    cMin,
    cMax,
    sMin,
    sMax,
    bestId,
    paretoPoints,
    frontierPolyline,
    frontierNames,
    catSeo,
    faqItems,
    homeHref,
    boardHomeLabel,
    itemList,
    datasetLd,
    collectionLd,
    crumbs,
    agoText,
  } = await getCachedBoardPayload(category, lang);

  return (
    <>
      <JsonLd data={[breadcrumbLd(crumbs), collectionLd, itemList, datasetLd, faqLd(faqItems)]} />
      <Breadcrumb
        lang={lang}
        items={[
          { name: isFa ? 'خانه' : 'Home', href: homeHref },
          { name: boardHomeLabel, href: category === 'overall' ? undefined : '/leaderboard' },
          ...(category === 'overall' ? [] : [{ name: label }]),
        ]}
        style={{ paddingTop: 28 }}
      />

      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 48, padding: '22px 0 40px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1.2 1 520px', minWidth: 0 }}>
          <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span className="led" />
            {isFa
              ? `رتبه‌بندی ویگاس · به‌روزرسانی ${faAgo(agoText)}`
              : `Vigas Ranks · updated ${agoText === 'now' ? 'just now' : `${agoText} ago`}`}
          </div>
          <h1
            className="sf"
            style={{
              fontSize: isFa ? 'clamp(36px,5.2vw,66px)' : 'clamp(48px,6.4vw,92px)',
              lineHeight: isFa ? 1.18 : 0.96,
              letterSpacing: isFa ? 0 : '-.032em',
              fontWeight: isFa ? 700 : 400,
              margin: '16px 0 18px',
            }}
          >
            {category === 'overall' ? (
              isFa ? (
                <>
                  سنجش هوش مصنوعی
                  <br />
                  در <em className="hi">آزمون واقعی.</em>
                </>
              ) : (
                <>
                  Measuring AI
                  <br />
                  in the <em className="hi">real world.</em>
                </>
              )
            ) : isFa ? (
              <>
                برترین مدل‌های {label}،
                <br />
                <em className="hi">بر اساس استفاده واقعی.</em>
              </>
            ) : (
              <>
                The best {label} models,
                <br />
                <em className="hi">ranked by real use.</em>
              </>
            )}
          </h1>
          <p style={{ fontSize: isFa ? 16.5 : 18, color: 'var(--vg-ink2)', maxWidth: 560, margin: 0, lineHeight: isFa ? 1.8 : undefined }}>
            {category === 'overall'
              ? isFa
                ? 'رده‌بندی ساخته‌شده از عملکرد واقعی مدل‌ها در ویگاس — هر نشست واقعی API، سرعت پاسخ و هر دلار هزینه.'
                : 'Rankings built from real people doing real work on Vigas — every session, every blind vote, every dollar spent.'
              : catSeo.intro}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <b className="mn" dir="ltr" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>
                {board.totalSessions.toLocaleString('en-US')}
              </b>
              <span style={{ color: 'var(--vg-ink2)', fontSize: 14 }}>{isFa ? 'نشست ارزیابی‌شده' : 'sessions ranked'}</span>
            </span>
            <a href="#method" className="link-arrow">
              {isFa ? 'روش محاسبه رتبه‌بندی' : 'How we rank →'}
              {isFa && <Icon name="arrow" size={14} />}
            </a>
          </div>
        </div>
        <div className="card" style={{ flex: '1 1 380px', minWidth: 0, padding: '22px 24px', borderRadius: 24 }}>
          <h2 className="lbl" style={{ margin: '0 0 8px' }}>
            {isFa ? `صعودی این هفته · ${label}` : `Rising this week · ${label}`}
          </h2>
          {risers.map(({ e, delta }) => {
            const pts = e.trend.length > 1 ? e.trend : [2, 3, 3, 4, 6, 5, 8];
            const minV = Math.min(...pts);
            const maxV = Math.max(...pts);
            const spanV = maxV - minV || 1;
            const sparkPts = pts
              .map((v, idx) => `${((idx / (pts.length - 1)) * 66 + 2).toFixed(1)},${(22 - ((v - minV) / spanV) * 18).toFixed(1)}`)
              .join(' ');
            return (
              <Link
                key={e.modelId}
                href={`/models?q=${encodeURIComponent(e.modelId)}`}
                className="hov"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0,1fr) 72px',
                  gap: 14,
                  alignItems: 'center',
                  padding: '13px 6px',
                  margin: '0 -6px',
                  borderRadius: 12,
                  borderTop: '1px solid var(--vg-line)',
                }}
              >
                <OrgMark org={e.org} size={40} radius={12} fontSize={18} />
                <span style={{ minWidth: 0 }}>
                  <b dir="ltr" style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : 'left' }}>
                    {shortName(e.name)}
                  </b>
                  <span style={{ fontSize: 13, color: 'var(--vg-ink3)' }}>
                    {isFa
                      ? `${delta >= 0 ? 'صعود' : 'افت'} ${Math.abs(delta).toFixed(2)} امتیاز · `
                      : `${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(2)} pts · `}
                    <b className="mn" dir="ltr" style={{ color: 'var(--vg-sand)', fontWeight: 600 }}>
                      #{e.rank}
                    </b>
                    {isFa ? ` در ${label}` : ` in ${label}`}
                  </span>
                </span>
                <svg viewBox="0 0 70 26" width="70" height="26" aria-hidden="true">
                  <polyline
                    points={sparkPts}
                    fill="none"
                    stroke={delta >= 0 ? '#3EE39B' : '#FF6B81'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            );
          })}
        </div>
      </header>

      <nav aria-label={isFa ? 'دسته‌های لیدربورد' : 'Leaderboard category'} className="scroll-x" style={{ display: 'flex', gap: 6, padding: '4px 0 6px' }}>
        {LEADERBOARD_CATEGORIES.map((c) => (
          <Link key={c.id} href={categoryPath(c.id)} className="tab" aria-current={c.id === category ? 'page' : undefined}>
            <Icon name={CATEGORY_ICON[c.id]} size={15} />
            {categoryLabel(c.id, lang)}
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
            backgroundImage: 'radial-gradient(var(--vg-dot) 1px,transparent 1.3px)',
            backgroundSize: '22px 22px',
            WebkitMaskImage: 'linear-gradient(#000,transparent 70%)',
            maskImage: 'linear-gradient(#000,transparent 70%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <h2 id="podium" className="sf" style={{ fontSize: isFa ? 'clamp(26px,2.8vw,34px)' : 'clamp(30px,3vw,40px)', margin: 0, letterSpacing: isFa ? 0 : '-.016em', fontWeight: isFa ? 700 : 400 }}>
            {isFa ? (
              <>
                سکوی قهرمانان · <em className="hi">{label}</em>
              </>
            ) : (
              <>
                The podium · <em className="hi">{label}</em>
              </>
            )}
          </h2>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {isFa ? 'سهم برد · این هفته' : 'Win share · this week'}
          </span>
        </div>
        <ol className="podium-list" dir="ltr">
          {podium.map((p) => {
            const i = p.rank - 1;
            const t = pillarTone(i);
            const h = [220, 160, 120][i] ?? 100;
            return (
              <li key={p.modelId} className="podium-col" style={{ order: i === 1 ? 0 : i === 0 ? 1 : 2 }}>
                <OrgMark org={p.org} size={46} radius={13} fontSize={22} />
                <b className="sf" style={{ fontSize: 'clamp(17px,2vw,26px)', fontWeight: 400, lineHeight: 1.1, marginTop: 10 }}>
                  <span className="sr-only">{isFa ? `رتبه ${p.rank}: ` : `Rank ${p.rank}: `}</span>
                  <Link href={`/models?q=${encodeURIComponent(p.modelId)}`} style={{ color: 'var(--vg-ink)' }}>
                    {shortName(p.name)}
                  </Link>
                </b>
                <span className="mn podium-meta" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 2 }}>
                  {p.org} · {Math.round(p.rating)} {isFa ? 'امتیاز' : 'score'}
                </span>
                <span className="sf podium-pct" style={{ color: t.vc }}>
                  {p.winRate.toFixed(2)}%
                </span>
                <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 3 }}>
                  <span style={{ display: 'block', width: '84%', height: 12, borderRadius: 3, background: t.fill }} />
                  <span style={{ display: 'block', width: '92%', height: 6, borderRadius: 2, background: t.fill, opacity: 0.7 }} />
                  <span
                    className="podium-bar"
                    style={
                      {
                        '--podium-h': `${h}px`,
                        background: `repeating-linear-gradient(90deg,${t.fill} 0 10px,${t.groove} 10px 12px)`,
                      } as CSSProperties
                    }
                  />
                </span>
                <span aria-hidden="true" className="podium-base">
                  <span className="sf" style={{ fontSize: 34, lineHeight: 1, color: t.vc }}>
                    {ROMAN[i]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={isFa ? 'جدول رتبه‌بندی' : 'Rankings'} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', paddingBottom: 72 }}>
        <RankingTable entries={entries} category={category} categoryLabel={label} siteUrl={SITE_URL} lang={lang} />

        <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ParetoChart
            points={paretoPoints}
            frontierPolyline={frontierPolyline}
            sMin={sMin}
            sMax={sMax}
            cMin={cMin}
            cMax={cMax}
            defaultSelectedId={bestId ?? paretoPoints[0]?.modelId ?? null}
            lang={lang}
            frontierAriaLabel={
              isFa
                ? `مرز بهینه پارتو برای ${label}: ${frontierNames.join('، ')}`
                : `Pareto frontier for ${label}: ${frontierNames.join(', ')} give the best score for their cost.`
            }
          />

          <div className="card" style={{ borderRadius: 22, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <h2 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: 0, fontWeight: isFa ? 700 : 400 }}>
                {isFa ? 'نشست‌های زنده' : 'Live sessions'}
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

      <section id="method" aria-labelledby="mh" style={{ padding: '0 0 64px', scrollMarginTop: 24 }}>
        <div className="lbl">{isFa ? '§ روش‌شناسی' : '§ Methodology'}</div>
        <h2
          id="mh"
          className="sf"
          style={{
            fontSize: isFa ? 'clamp(30px,3.6vw,46px)' : 'clamp(36px,4vw,56px)',
            lineHeight: isFa ? 1.2 : 1.02,
            letterSpacing: isFa ? 0 : '-.022em',
            fontWeight: isFa ? 700 : 400,
            margin: '12px 0 28px',
          }}
        >
          {isFa ? (
            <>
              رتبه‌بندی‌ها چگونه <em className="hi">محاسبه می‌شوند.</em>
            </>
          ) : (
            <>
              How the rankings <em className="hi">are made.</em>
            </>
          )}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {(isFa
            ? [
                ['I', 'var(--vg-orange)', 'var(--vg-orange-text)', 'نشست واقعی، نه بنچمارک مصنوعی', 'سهم برد نشان می‌دهد هر مدل چند بار تسک‌های واقعی مورد تأیید کاربران را در API، ایجنت‌های کدنویسی و ارزیابی‌های معتبر به پایان می‌رساند.'],
                ['II', 'var(--vg-sand)', 'var(--vg-sand)', 'امتیاز آماری و بازه اطمینان', 'تله‌متری نشست‌های موفق و بنچمارک‌های معتبر با مدل Bradley–Terry و بازه اطمینان ۹۵٪ تجمیع و به‌روزرسانی می‌شوند.'],
                ['III', 'var(--vg-ink3)', 'var(--vg-ink2)', 'هزینه بخشی از معیار است', 'کنار هر رتبه‌بندی میانگین هزینه به‌ازای هر کار انجام‌شده را می‌بینید تا بهترین ارزش خرید را بشناسید.'],
              ]
            : [
                ['I', 'var(--vg-orange)', 'var(--vg-orange-text)', 'Real sessions, not benchmarks', 'Win share counts how often a model finishes real tasks that users accept — across real API workloads, coding agents, and verified evals.'],
                ['II', 'var(--vg-sand)', 'var(--vg-sand)', 'Statistical scoring', 'Verified task outcomes and benchmarks are aggregated with a Bradley–Terry model and 95% confidence intervals.'],
                ['III', 'var(--vg-ink3)', 'var(--vg-ink2)', 'Cost is part of the score', 'Every ranking shows dollars per completed task, so you can see who is best for the money — not just best.'],
              ]
          ).map(([n, border, color, t, d]) => (
            <div key={n} style={{ borderTop: `2px solid ${border}`, paddingTop: 18 }}>
              <span className="sf" aria-hidden="true" style={{ fontSize: 40, color, lineHeight: 1 }}>
                {n}
              </span>
              <h3 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: '10px 0 6px', fontWeight: isFa ? 600 : 400 }}>
                {t}
              </h3>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: isFa ? 1.75 : undefined }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-linking & FAQ section for users & search indexing */}
      <section aria-labelledby="lb-faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, paddingBottom: 96, borderTop: '1px solid var(--vg-line)', paddingTop: 56 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="lbl">{isFa ? `§ ${label} · پرسش‌ها و دسترسی سریع` : `§ ${label} · Questions & explore`}</div>
          <h2
            id="lb-faq"
            className="sf"
            style={{
              fontSize: isFa ? 'clamp(28px,3.2vw,42px)' : 'clamp(34px,3.6vw,48px)',
              lineHeight: isFa ? 1.25 : 1.04,
              margin: '12px 0 16px',
              letterSpacing: isFa ? 0 : '-.02em',
              fontWeight: isFa ? 700 : 400,
            }}
          >
            {isFa ? (
              <>
                درباره جدول <em className="hi">{label}.</em>
              </>
            ) : (
              <>
                About the <em className="hi">{label.toLowerCase()}</em> board.
              </>
            )}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/tools/category/${catSeo.relatedToolCategory.toLowerCase()}`} className="tag">
              {catSeo.relatedToolLabel}
            </Link>
            <Link
              href={isFa ? `/news/fa/category/${catSeo.relatedNewsCategory.toLowerCase()}` : `/news/category/${catSeo.relatedNewsCategory.toLowerCase()}`}
              className="tag"
            >
              {isFa ? `اخبار ${catSeo.relatedNewsCategory}` : `${catSeo.relatedNewsCategory} news`}
            </Link>
            <Link href="/models" className="tag">
              {isFa ? 'تعرفه‌های API' : 'API prices'}
            </Link>
            <Link href="/models#quickstart" className="tag">
              {isFa ? 'راه‌اندازی سریع API' : 'API quickstart'}
            </Link>
          </div>
        </div>
        <div style={{ flex: '2 1 560px', minWidth: 0 }}>
          {faqItems.map((f) => (
            <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
              <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
              </summary>
              <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.8 : undefined }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
