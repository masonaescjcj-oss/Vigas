import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { formatCompact, formatPricePerMillion, timeAgo, type ModelListItem } from '@vigas/core';
import { Colonnade } from '@/components/colonnade';
import { HeroApiPanel } from '@/components/hero-api-panel';
import { LanguageSwitch } from '@/components/language-switch';
import { NewsletterForm } from '@/components/newsletter-form';
import { RouterViz } from '@/components/obsidian-viz';
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
    'Fastest, lowest-cost OpenAI-compatible AI API for Claude, GPT, Gemini & DeepSeek — plus live model leaderboards, AI newsroom, and curated AI tools.',
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
            className="dot-grid"
            style={{
              position: 'absolute',
              inset: 0,
              WebkitMaskImage: 'radial-gradient(ellipse 60% 75% at 30% 35%,#000 15%,transparent 72%)',
              maskImage: 'radial-gradient(ellipse 60% 75% at 30% 35%,#000 15%,transparent 72%)',
            }}
          />
          <div aria-hidden="true" className="hero-glow" />
          <div className="wrap hero-inner" style={{ position: 'relative' }}>
            <div style={{ flex: '1.05 1 460px', minWidth: 0 }}>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span className="led" />
                {models.length} models · {providers} labs · $0 markup
              </div>
              <h1 className="sf" style={{ fontSize: 'clamp(44px,6.6vw,92px)', lineHeight: 0.94, letterSpacing: '-.032em', margin: '16px 0 16px' }}>
                Fastest API.
                <br />
                <em className="hi">Lowest cost</em> per token.
              </h1>
              <p style={{ fontSize: 'clamp(15px,1.4vw,18px)', color: 'var(--vg-ink2)', maxWidth: 480, margin: '0 0 24px', lineHeight: 1.65 }}>
                One OpenAI‑compatible key for frontier AI — wholesale pricing and sub‑120ms routing.
              </p>
              <div className="home-cta-row">
                <a href="/chat" className="btn key" style={{ minHeight: 50, padding: '0 22px', fontSize: 15 }}>
                  <Icon name="spark" size={16} />
                  Open AI Chat
                </a>
                <Link href="/signup?next=/dashboard%23keys" className="btn gh" style={{ minHeight: 50, padding: '0 20px', fontSize: 15 }}>
                  Get API key
                </Link>
                <Link href="/models" className="btn gh home-cta-third" style={{ minHeight: 50, padding: '0 20px', fontSize: 15 }}>
                  Models &amp; pricing
                </Link>
              </div>
              <div className="mn hero-spec-strip">
                <span style={{ color: 'var(--vg-ink2)' }}>api.vigas.ai/v1</span>
                <span>·</span>
                <span>Auto-failover</span>
                <span>·</span>
                <span style={{ color: 'var(--vg-green)' }}>Free $5.00 credit</span>
              </div>
            </div>

            {/* Mobile-only compact RouterViz card right below hero CTA (matches vigas-design-2026 MHome) */}
            <div className="home-mob-only" style={{ width: '100%' }}>
              <div
                style={{
                  borderRadius: 24,
                  border: line,
                  background: 'var(--vg-surface)',
                  padding: '16px 16px 8px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="lbl" style={{ color: 'var(--vg-ink2)' }}>One key. Every mind.</span>
                  <span className="mn" style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: 'var(--vg-green-soft)', color: 'var(--vg-green)' }}>
                    p50 112ms
                  </span>
                </div>
                <RouterViz width={340} height={225} compact style={{ marginTop: 4 }} />
              </div>
            </div>

            <div style={{ flex: '1 1 430px', minWidth: 0 }}>
              <HeroApiPanel models={models} lang="en" />

              {/* Mobile-only 3-tile quick nav + vibrant $5 welcome credit card */}
              <div className="home-mob-only">
                <div className="home-quick-grid">
                  <Link href="/leaderboard" className="home-quick-tile">
                    <Icon name="bars" size={20} style={{ color: 'var(--vg-sand)' }} />
                    <span>Benchmarks</span>
                  </Link>
                  <Link href="/tools" className="home-quick-tile">
                    <Icon name="sliders" size={20} style={{ color: 'var(--vg-indigo)' }} />
                    <span>Tools</span>
                  </Link>
                  <Link href="/news" className="home-quick-tile">
                    <Icon name="text" size={20} style={{ color: 'var(--vg-green)' }} />
                    <span>News</span>
                  </Link>
                </div>
                <Link href="/signup?next=/dashboard" className="home-gift-banner bg-signal-grad">
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      insetInlineEnd: -34,
                      top: -34,
                      width: 140,
                      height: 140,
                      borderRadius: '50%',
                      border: '18px solid rgba(255,255,255,.15)',
                    }}
                  />
                  <div style={{ position: 'relative' }}>
                    <Icon name="spark" size={20} style={{ color: '#fff' }} />
                    <div className="dsp" style={{ fontSize: 42, lineHeight: 1.05, color: '#fff', marginTop: 8 }}>
                      $5.00
                    </div>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.9)', marginTop: 4 }}>
                      Welcome credit on signup — no card required
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Numbers ──────────────────────────────────────────────────── */}
        <section aria-label="Vigas in numbers" className="home-desk-only" style={{ borderBottom: line, background: 'var(--vg-bg2)' }}>
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

        {/* ── Obsidian Signal Statement · One key. Every mind. ────────── */}
        <section className="router-band home-desk-only" aria-label="One key, every frontier model">
          <div
            aria-hidden="true"
            className="line-grid"
            style={{
              position: 'absolute',
              inset: 0,
              WebkitMaskImage: 'radial-gradient(ellipse 65% 70% at 50% 55%, #000, transparent 74%)',
              maskImage: 'radial-gradient(ellipse 65% 70% at 50% 55%, #000, transparent 74%)',
            }}
          />
          <div className="router-band-grid">
            <div>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--vg-orange-text)' }}>§</span> The promise
              </div>
              <h2 className="dsp" style={{ fontSize: 'clamp(46px,6.4vw,88px)', margin: '16px 0 18px' }}>
                One key.
                <br />
                <span className="text-signal">Every mind.</span>
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.7, color: 'var(--vg-ink2)', maxWidth: 460, margin: 0 }}>
                Anthropic, OpenAI, Google, DeepSeek, Meta, xAI &amp; You.com — routed through one OpenAI-compatible endpoint with automatic failover in milliseconds.
              </p>
            </div>
            <RouterViz />
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
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Win share from {sessions} real gateway sessions and verified benchmarks — updated continuously.</p>
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

              <div className="pocket-card bg-signal-grad" style={{ flex: '1 1 320px' }}>
                <span className="mn" style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>Everywhere · Android &amp; iOS</span>
                <h3 className="sf" style={{ fontSize: 36, lineHeight: 1.04, margin: 0, letterSpacing: '-.02em', color: '#fff' }}>
                  Vigas,
                  <br />
                  <em style={{ fontStyle: 'italic' }}>in your pocket.</em>
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,.86)', maxWidth: 200, fontSize: 14, lineHeight: 1.6 }}>
                  API usage, rankings, news and your wallet — native and fast.
                </p>
                <div className="pocket-phone" aria-hidden="true">
                  <div style={{ width: 34, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.22)', margin: '0 auto' }} />
                  <div className="mn" style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: '#fff' }}>$5.00</div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', gap: 4, height: 54 }}>
                    {[30, 55, 40, 86, 28, 62, 48].map((h, idx) => (
                      <span
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${h}%`,
                          borderRadius: 3,
                          background: idx === 3 ? '#FF5A1F' : 'rgba(255,255,255,.2)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span
                  style={{
                    marginTop: 'auto',
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,.25)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  <Icon name="phone" size={14} />
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Drop-in Code Playground (Obsidian Signal 2026) ──────────── */}
        <section className="playground-band" aria-label="One-line OpenAI SDK integration">
          <div className="playground-grid">
            <div>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--vg-orange-text)' }}>§</span> Drop-in compatible
              </div>
              <h2 className="sf" style={{ fontSize: 'clamp(38px,4.8vw,60px)', lineHeight: 1.0, letterSpacing: '-.025em', margin: '14px 0 24px' }}>
                Change one line.
                <br />
                <span className="text-signal">Keep everything else.</span>
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  ['OpenAI SDK compatible', 'Python, Node, Go, cURL & Cursor — your existing code works today.'],
                  ['Automatic edge fallbacks', 'If a lab hiccups, Vigas reroutes in milliseconds with zero downtime.'],
                  ['One invoice, every model', 'Top up with Card, USDT, BTC, ETH, TON or Telegram Stars via AvexPay.'],
                ].map(([head, desc]) => (
                  <li key={head} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Icon name="check" size={14} />
                    </span>
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 600 }}>{head}</div>
                      <div style={{ fontSize: 14, color: 'var(--vg-ink2)', lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="playground-terminal">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
                <div style={{ display: 'flex', gap: 4, marginLeft: 14 }}>
                  {['Python', 'TypeScript', 'cURL', 'Cursor'].map((tabLabel, idx) => (
                    <span
                      key={tabLabel}
                      className="mn"
                      style={{
                        fontSize: 11.5,
                        padding: '4px 11px',
                        borderRadius: 999,
                        background: idx === 0 ? 'rgba(255,255,255,.11)' : 'transparent',
                        color: idx === 0 ? '#fff' : 'rgba(255,255,255,.45)',
                      }}
                    >
                      {tabLabel}
                    </span>
                  ))}
                </div>
                <span className="mn" style={{ marginLeft: 'auto', fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.78)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF5A1F' }} />
                  gemini-4-hydrogen
                </span>
              </div>
              <pre
                className="mn"
                style={{
                  margin: 0,
                  padding: '22px 22px',
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  overflowX: 'auto',
                  color: '#e7e5e0',
                }}
              >{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.vigas.ai/v1",
    api_key="sk-vg-v1-••••••••",
)

res = client.chat.completions.create(
    model="google/gemini-4-hydrogen",
    messages=[{"role": "user", "content": "Hello Vigas!"}],
)`}</pre>
              <div className="mn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3EE39B' }} />
                  200 OK · streamed 412 tokens
                </span>
                <span style={{ color: '#3EE39B' }}>$0.0000 (Free)</span>
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

        {/* ── Final CTA · Ship with every model ────────────────────────── */}
        <section className="sec-pad" aria-labelledby="daily-token">
          <div className="wrap">
            <div className="final-cta-card">
              <div
                aria-hidden="true"
                className="line-grid"
                style={{
                  position: 'absolute',
                  inset: 0,
                  WebkitMaskImage: 'linear-gradient(90deg, transparent, #000)',
                  maskImage: 'linear-gradient(90deg, transparent, #000)',
                }}
              />
              <div aria-hidden="true" className="final-cta-glow" />
              <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
                <div style={{ flex: '1.2 1 420px', minWidth: 0 }}>
                  <div className="lbl">§ The Daily Token</div>
                  <h2 id="daily-token" className="sf" style={{ fontSize: 'clamp(42px,5.2vw,72px)', lineHeight: 0.98, letterSpacing: '-.026em', margin: '14px 0 0' }}>
                    Ship with every model.
                    <br />
                    <span className="text-signal">Pay like it&apos;s one.</span>
                  </h2>
                </div>
                <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 14.5, color: 'var(--vg-ink2)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--vg-green-soft)', color: 'var(--vg-green)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="spark" size={16} />
                    </span>
                    <span>$5.00 free credit on signup — no card required.</span>
                  </div>
                  <NewsletterForm lang="en" />
                </div>
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

