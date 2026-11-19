import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { formatCompact, formatPricePerMillion, timeAgo, type ModelListItem } from '@vigas/core';
import { Colonnade } from '@/components/colonnade';
import { HeroApiPanel } from '@/components/hero-api-panel';
import { LanguageSwitch } from '@/components/language-switch';
import { NewsletterForm } from '@/components/newsletter-form';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ArrowLink, Avatar, Icon, JsonLd, OrgMark, SectionHead, ToolMark } from '@/components/ui';
import { getHomeFeed, getLeaderboardData, getModels, getNews, getTools } from '@/lib/data';
import { articleImageUrl } from '@/lib/media';
import { organizationLd, pageMetadata, websiteLd } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Vigas — Fastest & lowest-cost AI API for every frontier model',
  absoluteTitle: true,
  description:
    'Fastest, lowest-cost OpenAI-compatible AI API for Claude, GPT, Gemini & DeepSeek — plus live Arena leaderboards, AI newsroom, and curated AI tools.',
  path: '/',
  alternatesLanguages: { en: '/', fa: '/fa', 'x-default': '/' },
});

const line = '1px solid var(--vg-line)';

const priceChange = (m: ModelListItem) =>
  m.priceChange24h < 0
    ? { text: `▼ ${Math.abs(m.priceChange24h)}%`, color: 'var(--vg-green)' }
    : m.priceChange24h > 0
      ? { text: `▲ ${m.priceChange24h}%`, color: 'var(--vg-red)' }
      : { text: '—', color: 'var(--vg-ink3)' };

export default async function HomePage() {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'leaderboard', 'models', 'tools');

  const [feed, models, news, tools, board] = await Promise.all([
    getHomeFeed({ lang: 'en' }),
    getModels(),
    getNews({ lang: 'en', limit: 9 }),
    getTools({ sort: 'votes' }),
    getLeaderboardData('overall'),
  ]);
  const providers = new Set(models.map((m) => m.org)).size;
  const sessions = formatCompact(board.totalSessions);
  const sessionsNum = sessions.replace(/[a-zA-Z]+$/, '');
  const sessionsUnit = sessions.slice(sessionsNum.length);
  const now = new Date();
  const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const [lead, ...restNews] = news.items;
  const secondary = restNews.slice(0, 3);
  const rail = restNews.slice(3, 8);

  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <SiteHeader active="home" lang="en" />
      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: line }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(var(--vg-dot) 1px,transparent 1.3px)',
              backgroundSize: '24px 24px',
              WebkitMaskImage: 'radial-gradient(ellipse 55% 75% at 80% 40%,#000 15%,transparent 72%)',
              maskImage: 'radial-gradient(ellipse 55% 75% at 80% 40%,#000 15%,transparent 72%)',
            }}
          />
          <div className="wrap hero-inner">
            <div style={{ flex: '1.05 1 460px', minWidth: 0 }}>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span className="led" />
                {models.length} models · {providers} labs · $0 markup
              </div>
              <h1 className="sf" style={{ fontSize: 'clamp(42px,6.4vw,86px)', lineHeight: 0.96, letterSpacing: '-.032em', margin: '14px 0 14px' }}>
                Fastest API.
                <br />
                <em className="hi">Lowest cost</em> per token.
              </h1>
              <p style={{ fontSize: 'clamp(15px,1.4vw,17.5px)', color: 'var(--vg-ink2)', maxWidth: 460, margin: '0 0 20px', lineHeight: 1.55 }}>
                One OpenAI‑compatible key for frontier AI — wholesale pricing and sub‑120ms routing.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="/chat" className="btn key" style={{ minHeight: 46, padding: '0 20px', fontSize: 14.5 }}>
                  Open AI Chat
                  <Icon name="arrow" size={16} />
                </a>
                <Link href="/models" className="btn gh" style={{ minHeight: 46, padding: '0 20px', fontSize: 14.5 }}>
                  Models &amp; pricing
                </Link>
                <Link href="/signup?next=/dashboard%23keys" className="btn gh" style={{ minHeight: 46, padding: '0 18px', fontSize: 14.5 }}>
                  Get API key
                </Link>
              </div>
              <div className="mn hero-spec-strip">
                <span style={{ color: 'var(--vg-ink2)' }}>api.vigas.ai/v1</span>
                <span>·</span>
                <span>Auto-failover</span>
                <span>·</span>
                <span>Free first $5</span>
              </div>
            </div>

            <div style={{ flex: '1 1 430px', minWidth: 0 }}>
              <HeroApiPanel models={models} lang="en" />
            </div>
          </div>
        </section>

        {/* ── Numbers ──────────────────────────────────────────────────── */}
        <section aria-label="Vigas in numbers" style={{ borderBottom: line }}>
          <div className="stats">
            {[
              [String(models.length), null, 'Models online'],
              [String(providers), null, 'Providers'],
              [sessionsNum, sessionsUnit, 'Sessions ranked'],
              ['$0', null, 'Markup on first $5'],
            ].map(([big, unit, label]) => (
              <div key={label}>
                <div className="sf stat-val">
                  {big}
                  {unit && <em className="hi">{unit}</em>}
                </div>
                <div className="lbl" style={{ marginTop: 8 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── § 01 Platform ────────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="platform">
          <div className="wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 36 }}>
              <SectionHead
                id="platform"
                label="§ 01 — The platform"
                title={
                  <>
                    Four pillars.
                    <br />
                    <em className="hi">One key, lowest rates.</em>
                  </>
                }
              />
              <p style={{ maxWidth: 440, color: 'var(--vg-ink2)', margin: 0 }}>
                Compare frontier rankings on the live leaderboard, read bilingual AI dispatches, inspect curated apps, and ship on the fastest pass-through API gateway.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link href="/models" className="lift bento-card" style={{ flex: '2 1 520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="lbl">01 · API Gateway</span>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-orange-text)', background: 'var(--vg-orange-soft)', borderRadius: 6, padding: '3px 8px' }}>
                    Lowest rates · Auto-failover
                  </span>
                </div>
                <h3 className="sf" style={{ fontSize: 'clamp(28px,3vw,36px)', lineHeight: 1.04, margin: 0, letterSpacing: '-.016em' }}>
                  Every frontier model behind <em className="hi">one endpoint.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', maxWidth: 520 }}>
                  Prepaid credits, wholesale provider prices passed through with zero hidden fees, and automatic edge fallbacks across {providers} labs.
                </p>
                <div style={{ marginTop: 'auto', border: line, borderRadius: 14, overflow: 'hidden', background: 'var(--vg-bg2)' }}>
                  {feed.prices.slice(0, 3).map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) minmax(56px,auto) minmax(56px,auto)',
                        gap: 10,
                        alignItems: 'center',
                        padding: '11px 16px',
                        borderTop: i ? '1px solid var(--vg-line-soft)' : undefined,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <OrgMark org={m.org} size={22} radius={6} fontSize={11} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      </span>
                      <span className="mn" style={{ fontSize: 13, textAlign: 'right', color: 'var(--vg-ink2)' }}>
                        {formatPricePerMillion(m.inputPerMillionMicros)}
                      </span>
                      <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                        {formatPricePerMillion(m.outputPerMillionMicros)}
                      </span>
                    </div>
                  ))}
                </div>
              </Link>

              <Link href="/leaderboard" className="lift bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">02 · Leaderboard</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  Rankings from <em className="hi">real work.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Win share from {sessions} real sessions and blind Arena evaluations — not stale lab benchmarks.</p>
                <div
                  aria-hidden="true"
                  style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 10, height: 112, padding: '0 6px', borderBottom: '1px solid var(--vg-line2)' }}
                >
                  {feed.topAgents.slice(0, 6).map((a, i) => {
                    const max = feed.topAgents[0]?.winRate || 1;
                    const bg =
                      i === 0
                        ? 'repeating-linear-gradient(90deg,#FF6A1A 0 5px,#D9530C 5px 6px)'
                        : i < 3
                          ? 'repeating-linear-gradient(90deg,#E3B65C 0 5px,#B88E3F 5px 6px)'
                          : 'var(--vg-pillar)';
                    return <span key={a.modelId} style={{ flex: 1, height: `${Math.round((a.winRate / max) * 100)}%`, background: bg, borderRadius: '3px 3px 0 0' }} />;
                  })}
                </div>
              </Link>

              <Link href="/news" className="lift bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">03 · AI News</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  The news that <em className="hi">moves the models.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Original English reporting and dedicated Persian newsroom briefs backed by router telemetry.</p>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {feed.news.length > 0 ? (
                    feed.news.slice(0, 2).map((n) => (
                      <div key={n.slug} style={{ padding: '9px 0', borderTop: line }}>
                        <div className="mn" style={{ fontSize: 12, color: 'var(--vg-orange-text)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>
                            {n.category.toUpperCase()} · {timeAgo(n.publishedAt, now).toUpperCase()}
                          </span>
                        </div>
                        <div className="sf" style={{ fontSize: 18, lineHeight: 1.2, marginTop: 3 }}>
                          {n.title}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px 0 0', borderTop: line }}>
                      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-orange-text)' }}>
                        VIGAS NEWSROOM
                      </div>
                      <div className="sf" style={{ fontSize: 19, lineHeight: 1.2, marginTop: 4 }}>
                        New dispatches &amp; model briefs publishing soon →
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              <Link href="/tools" className="lift bento-card" style={{ flex: '1.2 1 340px' }}>
                <span className="lbl">04 · Tools</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  {tools.length} tools, <em className="hi">ranked by builders.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>What&apos;s new, what&apos;s trending and what&apos;s actually worth paying for.</p>
                <div aria-hidden="true" style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                  {tools.slice(0, 8).map((t) => (
                    <ToolMark
                      key={t.slug}
                      slug={t.slug}
                      iconUrl={t.iconUrl}
                      color={t.color}
                      letter={t.letter}
                      size={44}
                      radius={12}
                      fontSize={18}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
                    />
                  ))}
                </div>
              </Link>

              <div className="bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">Everywhere · Android</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  Vigas, <em className="hi">in your pocket.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>API usage, rankings, news and your wallet — native, fast and smooth.</p>
                <span className="btn gh" style={{ marginTop: 'auto', alignSelf: 'flex-start', cursor: 'default' }}>
                  <Icon name="phone" size={16} />
                  Android app · coming soon
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── § 02 Live market ─────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="market">
          <div className="wrap">
            <SectionHead id="market" label="§ 02 — Live market" title="Prices and rankings," accent="updated by the minute." style={{ marginBottom: 36 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 520px', minWidth: 0, background: 'var(--vg-surface)', border: line, borderRadius: 22, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: line, gap: 10 }}>
                  <h3 className="sf" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
                    Live prices
                  </h3>
                  <span className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="led" />
                    per 1M tokens
                  </span>
                </div>
                <div className="live-prices-list">
                  <div
                    aria-hidden="true"
                    className="mn live-prices-grid"
                    style={{ paddingTop: 10, paddingBottom: 10, fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--vg-bg2)' }}
                  >
                    <span>Model</span>
                    <span style={{ textAlign: 'right' }}>
                      Input
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      Output
                    </span>
                    <span className="col-24h" style={{ textAlign: 'right' }}>
                      24h
                    </span>
                  </div>
                  {feed.prices.map((m) => {
                    const chg = priceChange(m);
                    return (
                      <Link
                        key={m.id}
                        href={`/models?q=${encodeURIComponent(m.id)}`}
                        className="hov live-prices-grid"
                        style={{ paddingTop: 13, paddingBottom: 13, borderTop: '1px solid var(--vg-line-soft)', color: 'var(--vg-ink)' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <OrgMark org={m.org} size={30} radius={9} fontSize={15} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                            <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.id}
                            </span>
                          </span>
                        </span>
                        <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                          {formatPricePerMillion(m.inputPerMillionMicros)}
                        </span>
                        <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                          {formatPricePerMillion(m.outputPerMillionMicros)}
                        </span>
                        <span className="mn col-24h" style={{ fontSize: 12, textAlign: 'right', color: chg.color }}>
                          {chg.text}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <div style={{ padding: '14px 22px', borderTop: line }}>
                  <ArrowLink href="/models">All {models.length} models and prices</ArrowLink>
                </div>
              </div>

              <div style={{ flex: '1 1 520px', minWidth: 0, background: 'var(--vg-surface)', border: line, borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 className="sf" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
                    The colonnade
                  </h3>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink2)', border: '1px solid var(--vg-line2)', borderRadius: 6, padding: '3px 8px' }}>
                    Top agents · win share · this week
                  </span>
                </div>
                <Colonnade entries={feed.topAgents} />
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: line }}>
                  <ArrowLink href="/leaderboard">Full leaderboard</ArrowLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── § 03 News ────────────────────────────────────────────────── */}
        {lead && (
          <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="today">
            <div className="wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
                <SectionHead
                  id="today"
                  label={`§ 03 — Today in AI · ${today}`}
                  title={
                    <>
                      The <em className="hi">news</em> that moves the models
                    </>
                  }
                />
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <LanguageSwitch variant="link" targetLang="fa" altHref="/news/fa" langAttr="fa" dir="rtl" className="fa-ui pill" style={{ color: 'var(--vg-sand)' }}>
                    نسخه فارسی اخبار
                  </LanguageSwitch>
                  <ArrowLink href="/news" style={{ fontSize: 15 }}>
                    Newsroom
                  </ArrowLink>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
                <article className="st" style={{ flex: '1.5 1 460px', minWidth: 0 }}>
                  <Link href={`/news/${lead.slug}`} style={{ display: 'block', color: 'var(--vg-ink)' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 16, overflow: 'hidden', border: line, background: 'var(--vg-media-bg)' }}>
                      <img
                        src={articleImageUrl(lead.slug, lead.imageUrl)}
                        alt={lead.title}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {lead.flag && (
                        <span className="mn" style={badge(lead.flag)}>
                          {lead.flag.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mn" style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange-text)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{lead.category.toUpperCase()}</span>
                      <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {timeAgo(lead.publishedAt, now).toUpperCase()} AGO</span>
                    </div>
                    <h3
                      className="sf hl"
                      style={{
                        fontSize: 'clamp(30px,3vw,42px)',
                        lineHeight: 1.06,
                        letterSpacing: '-.02em',
                        margin: '10px 0',
                        fontWeight: 400,
                      }}
                    >
                      {lead.title}
                    </h3>
                    <p style={{ margin: '0 0 12px', color: 'var(--vg-ink2)', fontSize: 16, lineHeight: 1.55 }}>{lead.dek}</p>
                    <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={lead.author.name} color={lead.author.color} />
                      {lead.author.name} · {lead.readingMinutes} min read
                    </div>
                  </Link>
                </article>
                <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {secondary.map((n) => (
                    <article key={n.slug} className="st" style={{ padding: '0 0 20px', marginBottom: 20, borderBottom: line }}>
                      <Link href={`/news/${n.slug}`} style={{ display: 'flex', gap: 16, color: 'var(--vg-ink)', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange-text)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{n.category.toUpperCase()}</span>
                            <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {timeAgo(n.publishedAt, now).toUpperCase()}</span>
                          </div>
                          <h3
                            className="sf hl"
                            style={{
                              fontSize: 22,
                              lineHeight: 1.15,
                              margin: '6px 0 8px',
                              fontWeight: 400,
                            }}
                          >
                            {n.title}
                          </h3>
                          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                            {n.author.name}
                          </div>
                        </div>
                        <div style={{ width: 112, height: 112, flexShrink: 0, borderRadius: 14, overflow: 'hidden', border: line, background: 'var(--vg-media-bg)' }}>
                          <img
                            src={articleImageUrl(n.slug, n.imageUrl)}
                            alt={n.title}
                            width={112}
                            height={112}
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
                {rail.length > 0 && (
                  <aside style={{ flex: '1 1 280px', minWidth: 0 }} aria-label="More stories">
                    <div className="lbl" style={{ marginBottom: 6 }}>
                      § More stories
                    </div>
                    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {rail.map((n, i) => (
                        <li key={n.slug}>
                          <Link
                            href={`/news/${n.slug}`}
                            style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 10, padding: '14px 0', borderBottom: line, color: 'var(--vg-ink)' }}
                          >
                            <span className="sf" aria-hidden="true" style={{ fontSize: 30, lineHeight: 1, color: 'var(--vg-orange-text)' }}>
                              {i + 1}
                            </span>
                            <span>
                              <span
                                className="sf"
                                style={{
                                  display: 'block',
                                  fontSize: 18,
                                  lineHeight: 1.22,
                                  fontWeight: 400,
                                }}
                              >
                                {n.title}
                              </span>
                              <span
                                className="mn"
                                style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 6 }}
                              >
                                <span>
                                  {n.category} · {timeAgo(n.publishedAt, now)}
                                </span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </aside>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── § 04 Tools ───────────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="trending">
          <div className="wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
              <SectionHead
                id="trending"
                label="§ 04 — Trending tools"
                title={
                  <>
                    What builders are <em className="hi">upvoting</em> this week
                  </>
                }
              />
              <ArrowLink href="/tools" style={{ fontSize: 15 }}>
                Tools directory
              </ArrowLink>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 16 }}>
              {feed.trendingTools.slice(0, 4).map((t, i) => (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  className="lift"
                  style={{ background: 'var(--vg-surface)', border: line, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--vg-ink)', minWidth: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="sf" aria-hidden="true" style={{ fontSize: 44, lineHeight: 1, color: 'var(--vg-strong)' }}>
                      0{i + 1}
                    </span>
                    <span className="mn" style={{ fontSize: 12, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="up" size={14} />
                      {t.votes.toLocaleString('en-US')}
                      <span className="sr-only"> upvotes</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ToolMark slug={t.slug} iconUrl={t.iconUrl} color={t.color} letter={t.letter} size={46} radius={13} fontSize={22} />
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>{t.name}</span>
                      <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                        {t.category} · ★ {t.rating.toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14 }}>{t.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Newsletter ───────────────────────────────────────────────── */}
        <section className="sec-pad" aria-labelledby="daily-token">
          <div className="wrap">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 40,
                alignItems: 'center',
                padding: 'clamp(24px,4vw,56px)',
                borderRadius: 28,
                background: 'var(--vg-surface)',
                border: line,
              }}
            >
              <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                <div className="lbl">§ The Daily Token</div>
                <h2 id="daily-token" className="sf" style={{ fontSize: 'clamp(36px,4vw,54px)', lineHeight: 1.02, letterSpacing: '-.022em', margin: '12px 0' }}>
                  Five minutes. <em className="hi">Every model that matters.</em>
                </h2>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Launches, price moves and the one chart you need — every weekday morning.</p>
              </div>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <NewsletterForm lang="en" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}

function badge(flag: string): CSSProperties {
  return {
    position: 'absolute',
    left: 14,
    top: 14,
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: flag === 'Analysis' ? 'var(--vg-sand-fill)' : 'var(--vg-orange)',
    color: 'var(--vg-on-orange)',
    letterSpacing: '.06em',
  };
}

