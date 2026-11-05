import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { formatCompact, formatPricePerMillion, timeAgo, type ModelListItem } from '@vigas/core';
import { orgMark, withAlpha } from '@vigas/tokens';
import { Colonnade } from '@/components/colonnade';
import { CoverArt, TypoCover } from '@/components/covers';
import { HomeAsk } from '@/components/home-ask';
import { NewsletterForm } from '@/components/newsletter-form';
import { SiteHeader } from '@/components/site-header';
import { ArrowLink, Avatar, Icon, JsonLd, Mark, OrgMark, SectionHead } from '@/components/ui';
import { getHomeFeed, getLeaderboardData, getModels, getNews, getTools } from '@/lib/data';
import { organizationLd, pageMetadata, websiteLd } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Vigas — One key for every AI model',
  absoluteTitle: true,
  description:
    'Route to every major AI model through one OpenAI-compatible endpoint with prepaid credits and honest per-token prices. Plus a live AI leaderboard, AI news and the best AI tools.',
  path: '/',
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
    getHomeFeed(),
    getModels(),
    getNews({ limit: 9 }),
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
  const routeModels = ['deepseek/v4.1-flash', 'anthropic/claude-sonnet-5.5', 'google/gemini-4-argon', 'openai/gpt-6.1-terra']
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelListItem => Boolean(m));
  const routeMeta = [
    { ms: '291 ms', w: '34%', st: 'Rate-limited', sc: 'var(--vg-red)', bar: '#4A4540', bg: 'transparent' },
    { ms: '412 ms', w: '48%', st: 'Selected', sc: 'var(--vg-orange-text)', bar: 'var(--vg-orange)', bg: 'rgba(255,106,26,.08)' },
    { ms: '538 ms', w: '63%', st: 'Standby', sc: 'var(--vg-ink3)', bar: '#4A4540', bg: 'transparent' },
    { ms: '604 ms', w: '71%', st: 'Standby', sc: 'var(--vg-ink3)', bar: '#4A4540', bg: 'transparent' },
  ];

  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <SiteHeader active="home" />
      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: line }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(239,234,225,.13) 1px,transparent 1.3px)',
              backgroundSize: '24px 24px',
              WebkitMaskImage: 'radial-gradient(ellipse 55% 75% at 80% 40%,#000 15%,transparent 72%)',
              maskImage: 'radial-gradient(ellipse 55% 75% at 80% 40%,#000 15%,transparent 72%)',
            }}
          />
          <div className="wrap" style={{ position: 'relative', paddingTop: 76, paddingBottom: 84, display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center' }}>
            <div style={{ flex: '1 1 540px', minWidth: 0 }}>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span className="led" />
                {models.length} models · {providers} providers · one endpoint
              </div>
              <h1 className="sf" style={{ fontSize: 'clamp(52px,7vw,100px)', lineHeight: 0.94, letterSpacing: '-.032em', margin: '20px 0 22px' }}>
                One key.
                <br />
                <em className="hi">Every</em> frontier model.
              </h1>
              <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 560, margin: 0, lineHeight: 1.6 }}>
                Route to every major model through one OpenAI‑compatible endpoint. Honest per‑token prices, automatic fallbacks — and the
                same key powers Vigas Chat and RetroBuild.
              </p>
              <HomeAsk models={models.map((m) => ({ id: m.id, name: m.name }))} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
                <Link href="/signup?next=/dashboard%23keys" className="btn key" style={{ minHeight: 50, padding: '0 24px', fontSize: 15 }}>
                  Get your API key
                  <Icon name="arrow" size={16} />
                </Link>
                <Link href="/models" className="btn gh" style={{ minHeight: 50, padding: '0 24px', fontSize: 15 }}>
                  Browse {models.length} models
                </Link>
              </div>
            </div>

            <div style={{ flex: '1 1 440px', minWidth: 0 }}>
              <figure
                aria-label="Example request routed by vigas/auto"
                style={{ margin: 0, background: 'var(--vg-bg2)', border: '1px solid var(--vg-line2)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 80px -40px rgba(0,0,0,.8)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: line }}>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-on-orange)', background: 'var(--vg-sand)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                    POST
                  </span>
                  <span className="mn" style={{ fontSize: 13, color: 'var(--vg-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    api.vigas.ai/v1/chat/completions
                  </span>
                  <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span className="led" />
                    200 OK
                  </span>
                </div>
                <pre
                  className="mn"
                  style={{ margin: 0, padding: '18px 20px', background: 'var(--vg-code)', fontSize: 13, lineHeight: 1.75, color: '#D9D3C7', overflowX: 'auto', borderBottom: line }}
                >
                  <span style={{ color: 'var(--vg-ink3)' }}>{'{'}</span>
                  {'\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;model&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;vigas/auto&quot;</span>,{'\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;route&quot;</span>: {'{ '}
                  <span style={{ color: '#FF8A4C' }}>&quot;sort&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;latency&quot;</span>,{' '}
                  <span style={{ color: '#FF8A4C' }}>&quot;fallbacks&quot;</span>: <span style={{ color: '#A5A8FF' }}>true</span>
                  {' },\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;messages&quot;</span>: [{'{ '}
                  <span style={{ color: '#FF8A4C' }}>&quot;role&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;user&quot;</span>,{' '}
                  <span style={{ color: '#FF8A4C' }}>&quot;content&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;Summarize this contract&quot;</span>
                  {' }]\n'}
                  <span style={{ color: 'var(--vg-ink3)' }}>{'}'}</span>
                </pre>
                <div style={{ padding: '16px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="lbl">Routing</span>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {routeModels.length} candidates
                  </span>
                </div>
                <div style={{ padding: '0 10px 10px' }}>
                  {routeModels.map((m, i) => {
                    const r = routeMeta[i]!;
                    const mk = orgMark(m.org);
                    return (
                      <div
                        key={m.id}
                        style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) 92px', gap: 12, alignItems: 'center', padding: '10px 8px', borderRadius: 12, background: r.bg }}
                      >
                        <Mark color={mk.color} letter={mk.letter} size={30} radius={9} fontSize={13} />
                        <div style={{ minWidth: 0 }}>
                          <div className="mn" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.id}
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--vg-raised)', marginTop: 7, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: r.w, background: r.bar, borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mn" style={{ fontSize: 13 }}>
                            {r.ms}
                          </div>
                          <div style={{ fontSize: 12, color: r.sc }}>{r.st}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderTop: line }}>
                  {[
                    ['Tokens', '1,284', undefined],
                    ['Cost', '$0.0041', 'var(--vg-green)'],
                    ['Latency', '0.41 s', undefined],
                  ].map(([k, v, c], i) => (
                    <div key={k} style={{ padding: '14px 18px', borderLeft: i ? line : undefined }}>
                      <div className="lbl">{k}</div>
                      <div className="mn" style={{ fontSize: 16, marginTop: 4, color: c }}>
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
                <figcaption className="sr-only">Illustration of a request routed across four candidate models.</figcaption>
              </figure>
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
                <div className="sf" style={{ fontSize: 52, lineHeight: 1, letterSpacing: '-.02em' }}>
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
        <section style={{ padding: '96px 0', borderBottom: line }} aria-labelledby="platform">
          <div className="wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 36 }}>
              <SectionHead
                id="platform"
                label="§ 01 — The platform"
                title={
                  <>
                    Six products.
                    <br />
                    <em className="hi">One account, one balance.</em>
                  </>
                }
              />
              <p style={{ maxWidth: 420, color: 'var(--vg-ink2)', margin: 0 }}>
                Every Vigas product runs on the same credits and the same key — so what you learn on the leaderboard, you can ship through the API
                tonight.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link href="/models" className="lift" style={bento('2 1 560px')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="lbl">01 · API Gateway</span>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-orange)', background: 'var(--vg-orange-soft)', borderRadius: 6, padding: '3px 8px' }}>
                    OpenAI-compatible
                  </span>
                </div>
                <h3 className="sf" style={{ fontSize: 36, lineHeight: 1.04, margin: 0, letterSpacing: '-.016em' }}>
                  Every model behind <em className="hi">one endpoint.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', maxWidth: 500 }}>
                  Prepaid credits, provider prices passed through, automatic fallbacks and usage you can read at a glance.
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
                        borderTop: i ? '1px solid rgba(239,234,225,.06)' : undefined,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
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

              <Link href="/chat" className="lift" style={bento('1 1 340px')}>
                <span className="lbl">02 · Vigas Chat</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  Ask any model. <em className="hi">Or two at once.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Chat with every model in the gateway. In Arena mode, your vote shapes the leaderboard.</p>
                <div aria-hidden="true" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ alignSelf: 'flex-end', background: 'var(--vg-raised)', border: line, borderRadius: '14px 14px 4px 14px', padding: '8px 12px', fontSize: 13 }}>
                    Which model is best for contracts?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ border: '1px solid rgba(255,106,26,.5)', background: 'rgba(255,106,26,.07)', borderRadius: 12, padding: 10 }}>
                      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-orange)' }}>
                        A · voted
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--vg-pillar)', marginTop: 8 }} />
                      <div style={{ height: 5, width: '70%', borderRadius: 3, background: 'var(--vg-pillar)', marginTop: 5 }} />
                    </div>
                    <div style={{ border: '1px solid rgba(239,234,225,.1)', borderRadius: 12, padding: 10 }}>
                      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                        B
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--vg-strong)', marginTop: 8 }} />
                      <div style={{ height: 5, width: '55%', borderRadius: 3, background: 'var(--vg-strong)', marginTop: 5 }} />
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/leaderboard" className="lift" style={bento('1 1 340px')}>
                <span className="lbl">03 · Leaderboard</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  Rankings from <em className="hi">real work.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Win share from {sessions} real sessions and blind votes — not lab benchmarks.</p>
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

              <Link href="/news" className="lift" style={bento('1 1 340px')}>
                <span className="lbl">04 · AI News</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  The news that <em className="hi">moves the models.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Breaking stories, deep analysis and a five-minute morning brief.</p>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {feed.news.slice(0, 2).map((n) => (
                    <div key={n.slug} style={{ padding: '9px 0', borderTop: line }}>
                      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-orange)' }}>
                        {n.category.toUpperCase()} · {timeAgo(n.publishedAt, now).toUpperCase()}
                      </div>
                      <div className="sf" style={{ fontSize: 18, lineHeight: 1.2 }}>
                        {n.title}
                      </div>
                    </div>
                  ))}
                </div>
              </Link>

              <Link href="/tools" className="lift" style={bento('1 1 340px')}>
                <span className="lbl">05 · Tools</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  {tools.length} tools, <em className="hi">ranked by builders.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>What&apos;s new, what&apos;s trending and what&apos;s actually worth paying for.</p>
                <div aria-hidden="true" style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                  {tools.slice(0, 8).map((t) => (
                    <span
                      key={t.slug}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        font: '400 20px var(--vg-font-serif)',
                        background: withAlpha(t.color, 0.15),
                        color: t.color,
                        boxShadow: `inset 0 0 0 1px ${withAlpha(t.color, 0.3)}`,
                      }}
                    >
                      {t.letter}
                    </span>
                  ))}
                </div>
              </Link>

              <Link href="/retrobuild" className="lift" style={{ ...bento('2 1 560px'), flexDirection: 'row', flexWrap: 'wrap', gap: 28, borderColor: 'rgba(255,106,26,.32)' }}>
                <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <span className="lbl" style={{ color: 'var(--vg-orange-text)' }}>
                    06 · RetroBuild
                  </span>
                  <h3 className="sf" style={{ fontSize: 36, lineHeight: 1.04, margin: 0, letterSpacing: '-.016em' }}>
                    Describe an app. <em className="hi">Ship it tonight.</em>
                  </h3>
                  <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>An agent that writes, previews and checkpoints your app — billed to the same Vigas credits.</p>
                </div>
                <div aria-hidden="true" style={{ flex: '1 1 240px', background: 'var(--vg-bg2)', border: line, borderRadius: 14, padding: '14px 16px', alignSelf: 'stretch' }}>
                  {['Schema & local store', 'Streak counter'].map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? '1px dashed rgba(239,234,225,.1)' : undefined }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(111,207,115,.18)', color: 'var(--vg-green)', display: 'grid', placeItems: 'center' }}>
                        <Icon name="check" size={11} />
                      </span>
                      <span style={{ fontSize: 13 }}>{s}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px dashed rgba(239,234,225,.1)' }}>
                    <span className="spin" style={{ width: 16, height: 16, borderColor: 'var(--vg-orange)', borderTopColor: 'transparent' }} />
                    <span style={{ fontSize: 13 }}>Weekly heatmap…</span>
                    <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-orange-text)' }}>
                      v7
                    </span>
                  </div>
                </div>
              </Link>

              <div style={bento('1 1 340px')}>
                <span className="lbl">Everywhere · Android</span>
                <h3 className="sf" style={{ fontSize: 32, lineHeight: 1.05, margin: 0, letterSpacing: '-.016em' }}>
                  Vigas, <em className="hi">in your pocket.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>Chat, rankings, news and your wallet — native, fast and smooth.</p>
                <span className="btn gh" style={{ marginTop: 'auto', alignSelf: 'flex-start', cursor: 'default' }}>
                  <Icon name="phone" size={16} />
                  Android app · coming soon
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── § 02 Live market ─────────────────────────────────────────── */}
        <section style={{ padding: '96px 0', borderBottom: line }} aria-labelledby="market">
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
                <div className="tablewrap">
                  <div style={{ minWidth: 480 }}>
                    <div
                      aria-hidden="true"
                      className="mn"
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px 84px 84px', gap: 12, padding: '10px 22px', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--vg-bg2)' }}
                    >
                      <span>Model</span>
                      <span style={{ textAlign: 'right' }}>
                        Input
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        Output
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        24h
                      </span>
                    </div>
                    {feed.prices.map((m) => {
                      const chg = priceChange(m);
                      return (
                        <Link
                          key={m.id}
                          href={`/models?q=${encodeURIComponent(m.id)}`}
                          className="hov"
                          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px 84px 84px', gap: 12, alignItems: 'center', padding: '13px 22px', borderTop: '1px solid rgba(239,234,225,.06)', color: 'var(--vg-ink)' }}
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
                          <span className="mn" style={{ fontSize: 12, textAlign: 'right', color: chg.color }}>
                            {chg.text}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
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
          <section style={{ padding: '96px 0', borderBottom: line }} aria-labelledby="today">
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
                <ArrowLink href="/news" style={{ fontSize: 15 }}>
                  Newsroom
                </ArrowLink>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
                <article className="st" style={{ flex: '1.5 1 460px', minWidth: 0 }}>
                  <Link href={`/news/${lead.slug}`} style={{ display: 'block', color: 'var(--vg-ink)' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 16, overflow: 'hidden', border: line, background: '#151411' }}>
                      <CoverArt seed={lead.slug} color={lead.cover.color} category={lead.category} />
                      {lead.flag && (
                        <span className="mn" style={badge(lead.flag)}>
                          {lead.flag.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mn" style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange)' }}>
                      {lead.category.toUpperCase()}{' '}
                      <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {timeAgo(lead.publishedAt, now).toUpperCase()} AGO</span>
                    </div>
                    <h3 className="sf hl" style={{ fontSize: 'clamp(30px,3vw,42px)', lineHeight: 1.06, letterSpacing: '-.02em', margin: '10px 0' }}>
                      {lead.title}
                    </h3>
                    <p style={{ margin: '0 0 12px', color: 'var(--vg-ink2)', fontSize: 16 }}>{lead.dek}</p>
                    <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={lead.author.name} color={lead.author.color} />
                      {lead.author.name} · {lead.readingMinutes} min read
                    </div>
                  </Link>
                </article>
                <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {secondary.map((n) => (
                    <article key={n.slug} className="st" style={{ padding: '0 0 20px', marginBottom: 20, borderBottom: line }}>
                      <Link href={`/news/${n.slug}`} style={{ display: 'flex', gap: 16, color: 'var(--vg-ink)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange)' }}>
                            {n.category.toUpperCase()} <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {timeAgo(n.publishedAt, now).toUpperCase()}</span>
                          </div>
                          <h3 className="sf hl" style={{ fontSize: 22, lineHeight: 1.15, margin: '6px 0 8px' }}>
                            {n.title}
                          </h3>
                          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                            {n.author.name}
                          </div>
                        </div>
                        <TypoCover cover={n.cover} style={{ width: 112, height: 112, flexShrink: 0 }} />
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
                            <span className="sf" aria-hidden="true" style={{ fontSize: 30, lineHeight: 1, color: 'var(--vg-orange)' }}>
                              {i + 1}
                            </span>
                            <span>
                              <span className="sf" style={{ display: 'block', fontSize: 18, lineHeight: 1.22 }}>
                                {n.title}
                              </span>
                              <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 6 }}>
                                {n.category} · {timeAgo(n.publishedAt, now)}
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
        <section style={{ padding: '96px 0', borderBottom: line }} aria-labelledby="trending">
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
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
                    <Mark color={t.color} letter={t.letter} size={46} radius={13} fontSize={22} />
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
        <section style={{ padding: '96px 0' }} aria-labelledby="daily-token">
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
                <NewsletterForm />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function bento(flex: string): CSSProperties {
  return {
    flex,
    minWidth: 0,
    background: 'var(--vg-surface)',
    border: '1px solid var(--vg-line)',
    borderRadius: 22,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    color: 'var(--vg-ink)',
  };
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
    background: flag === 'Analysis' ? 'var(--vg-sand)' : 'var(--vg-orange)',
    color: 'var(--vg-on-orange)',
    letterSpacing: '.06em',
  };
}
