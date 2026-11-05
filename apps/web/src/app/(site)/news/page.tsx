import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { Suspense, type CSSProperties } from 'react';
import { NEWS_CATEGORIES, timeAgo, type NewsCategory, type NewsListItem } from '@vigas/core';
import { CoverArt, TypoCover } from '@/components/covers';
import { NewsletterForm } from '@/components/newsletter-form';
import { SiteHeader } from '@/components/site-header';
import { Avatar, Icon, JsonLd } from '@/components/ui';
import { getNews } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

const PAGE_SIZE = 8;
/** Stories shown in the "Top stories" block on the first page of "All". */
const TOP = 4;

const line = '1px solid var(--vg-line)';

function parse(sp: Record<string, string | string[] | undefined>): { category: NewsCategory | null; page: number } {
  const c = typeof sp.category === 'string' ? sp.category : null;
  const category = c && NEWS_CATEGORIES.includes(c as NewsCategory) ? (c as NewsCategory) : null;
  const p = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : 1;
  return { category, page: Number.isFinite(p) && p >= 1 && p <= 1000 ? p : 1 };
}

function newsPath(category: NewsCategory | null, page = 1): string {
  const q = new URLSearchParams();
  if (category) q.set('category', category);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `/news?${s}` : '/news';
}

export async function generateMetadata({ searchParams }: PageProps<'/news'>): Promise<Metadata> {
  const { category, page } = parse(await searchParams);
  const base = category ? `${category} AI news` : 'AI News — models, agents, policy and funding';
  return pageMetadata({
    title: page > 1 ? `${base} · page ${page}` : base,
    description: category
      ? `The latest ${category.toLowerCase()} stories in AI from the Vigas Newsroom: launches, prices, rankings and analysis.`
      : 'AI news from the Vigas Newsroom: model launches, agents, inference prices, policy, hardware and funding — with live leaderboard and price data.',
    path: newsPath(category, page),
  });
}

export default function NewsPage({ searchParams }: PageProps<'/news'>) {
  return (
    <>
      <SiteHeader active="news" />
      <main id="main">
        <Masthead />
        <Suspense fallback={<RiverSkeleton />}>
          <NewsBody searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Masthead() {
  'use cache';
  cacheLife('content');
  cacheTag('news');
  const now = new Date();
  const { items, total } = await getNews({ limit: 20 });
  const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fresh = items.filter((n) => now.getTime() - new Date(n.publishedAt).getTime() < 86_400_000).length;
  const updated = items[0] ? timeAgo(items[0].publishedAt, now) : null;
  return (
    <header className="wrap" style={{ paddingTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', paddingBottom: 20, borderBottom: '3px double rgba(239,234,225,.18)' }}>
        <div>
          <div className="lbl" style={{ marginBottom: 10 }}>
            § Vigas Newsroom
          </div>
          <h1 className="sf" style={{ fontSize: 'clamp(64px,10vw,150px)', lineHeight: 0.84, letterSpacing: '-.045em', margin: 0 }}>
            AI <em className="hi">News</em>
          </h1>
        </div>
        <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.1em', lineHeight: 1.9, textAlign: 'right' }}>
          {today}
          <br />
          {updated ? `Updated ${updated === 'now' ? 'just now' : `${updated} ago`} · ` : ''}
          {fresh} new {fresh === 1 ? 'story' : 'stories'} today · {total} in total
        </div>
      </div>
    </header>
  );
}

async function NewsBody({ searchParams }: Pick<PageProps<'/news'>, 'searchParams'>) {
  const { category, page } = parse(await searchParams);
  return <NewsContent category={category} page={page} />;
}

async function NewsContent({ category, page }: { category: NewsCategory | null; page: number }) {
  'use cache';
  cacheLife('content');
  cacheTag('news');
  const now = new Date();
  const showTop = !category && page === 1;
  const skip = category ? 0 : TOP;
  const [river, top, analysis, pool] = await Promise.all([
    getNews({ category, limit: PAGE_SIZE, offset: skip + (page - 1) * PAGE_SIZE }),
    showTop ? getNews({ limit: TOP }) : Promise.resolve(null),
    showTop ? getNews({ category: 'Analysis', limit: 3 }) : Promise.resolve(null),
    getNews({ limit: 30 }),
  ]);
  const pages = Math.max(1, Math.ceil(Math.max(0, river.total - skip) / PAGE_SIZE));
  const longReads = [...pool.items].sort((a, b) => b.readingMinutes - a.readingMinutes).slice(0, 5);
  const brief = pool.items.slice(0, 4);
  const listed = [...(top?.items ?? []), ...river.items];
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'News', path: '/news' },
    ...(category ? [{ name: category, path: newsPath(category) }] : []),
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: category ? `${category} AI news` : 'AI news',
            itemListElement: listed.map((n, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/news/${n.slug}`), name: n.title })),
          },
        ]}
      />
      <nav aria-label="News sections" style={{ borderBottom: line, background: 'rgba(18,17,15,.92)' }}>
        <div className="wrap scroll-x" style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', gap: 6 }}>
          <Link href="/news" className="chip" aria-current={!category ? 'page' : undefined} style={{ minHeight: 38, padding: '0 15px' }}>
            All
          </Link>
          {NEWS_CATEGORIES.map((c) => (
            <Link key={c} href={newsPath(c)} className="chip" aria-current={category === c ? 'page' : undefined} style={{ minHeight: 38, padding: '0 15px' }}>
              {c}
            </Link>
          ))}
        </div>
      </nav>

      {showTop && top && top.items[0] && <TopStories items={top.items} now={now} />}

      {showTop && analysis && analysis.items.length > 0 && (
        <section aria-labelledby="an" className="wrap" style={{ paddingTop: 56, paddingBottom: 56, borderBottom: line }}>
          <div style={{ marginBottom: 26 }}>
            <div className="lbl">§ Analysis</div>
            <h2 id="an" className="sf" style={{ fontSize: 'clamp(34px,3.6vw,48px)', margin: '10px 0 0', letterSpacing: '-.02em', lineHeight: 1.04 }}>
              Arguments worth <em className="hi">your five minutes.</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {analysis.items.map((x) => (
              <Link
                key={x.slug}
                href={`/news/${x.slug}`}
                className="st card"
                style={{ borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 280, color: 'var(--vg-ink)' }}
              >
                <span className="sf" aria-hidden="true" style={{ fontSize: 72, lineHeight: 0.5, height: 28, color: 'var(--vg-sand)' }}>
                  “
                </span>
                <h3 className="sf hl" style={{ fontSize: 27, lineHeight: 1.14, margin: 0, fontWeight: 400 }}>
                  {x.title}
                </h3>
                <span style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <Avatar name={x.author.name} color={x.author.color} size={32} />
                  <span>
                    <b style={{ fontWeight: 500, display: 'block' }}>{x.author.name}</b>
                    <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                      {x.readingMinutes} min read
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="wrap" style={{ paddingTop: 44, paddingBottom: 96, display: 'flex', flexWrap: 'wrap', gap: 44 }}>
        <div style={{ flex: '999 1 600px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 className="sf" style={{ fontSize: 34, margin: 0, fontWeight: 400, letterSpacing: '-.015em' }}>
              Latest · <em className="hi">{category ?? 'all sections'}</em>
            </h2>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {river.total} {river.total === 1 ? 'story' : 'stories'}
              {pages > 1 ? ` · page ${page} of ${pages}` : ''}
            </span>
          </div>
          {river.items.length === 0 ? (
            <p style={{ padding: '40px 0', color: 'var(--vg-ink2)', borderTop: line, margin: 0 }}>
              {page > 1 ? 'No more stories on this page. ' : 'No stories in this section yet. '}
              <Link href={newsPath(category)} style={{ color: 'var(--vg-indigo)' }}>
                Back to the latest
              </Link>
            </p>
          ) : (
            river.items.map((n) => <RiverItem key={n.slug} n={n} now={now} />)
          )}
          {pages > 1 && (
            <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderTop: line, paddingTop: 22 }}>
              {page < pages ? (
                <Link href={newsPath(category, page + 1)} className="btn key" rel="next">
                  More stories
                  <Icon name="arrow" size={16} />
                </Link>
              ) : (
                <Link href={newsPath(category, page - 1)} className="btn gh" rel="prev">
                  Newer stories
                </Link>
              )}
              <span className="mn" style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={newsPath(category, p)}
                    aria-current={p === page ? 'page' : undefined}
                    aria-label={`Page ${p}`}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 13,
                      background: p === page ? 'var(--vg-raised)' : undefined,
                      color: p === page ? 'var(--vg-ink)' : 'var(--vg-ink2)',
                    }}
                  >
                    {p}
                  </Link>
                ))}
              </span>
            </nav>
          )}
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }} aria-label="More from the newsroom">
          <div className="card" style={{ padding: 22 }}>
            <div className="lbl">§ The brief</div>
            <h2 className="sf" style={{ fontSize: 26, margin: '6px 0 12px', fontWeight: 400 }}>
              In 60 seconds
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--vg-ink2)', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {brief.map((n) => (
                <li key={n.slug}>
                  <Link href={`/news/${n.slug}`} style={{ color: 'var(--vg-ink2)' }}>
                    {n.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/chat?q=${encodeURIComponent('Summarize today’s AI news in five bullet points.')}`} className="btn gh" style={{ width: '100%', marginTop: 16 }}>
              <Icon name="chat" size={16} />
              Ask Vigas about today’s news
            </Link>
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h2 className="lbl" style={{ margin: 0 }}>
              § Long reads
            </h2>
            <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
              {longReads.map((m, i) => (
                <li key={m.slug}>
                  <Link href={`/news/${m.slug}`} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, padding: '12px 0', borderTop: '1px solid rgba(239,234,225,.06)', color: 'var(--vg-ink)' }}>
                    <span className="sf" aria-hidden="true" style={{ fontSize: 26, lineHeight: 1, color: 'var(--vg-ink3)' }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 14, lineHeight: 1.38 }}>
                      {m.title} <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>· {m.readingMinutes} min</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h2 className="lbl" style={{ margin: '0 0 12px' }}>
              § Topics
            </h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NEWS_CATEGORIES.map((c) => (
                <Link key={c} href={newsPath(c)} className="tag">
                  {c}
                </Link>
              ))}
              <Link href="/leaderboard" className="tag">
                Leaderboard
              </Link>
              <Link href="/models" className="tag">
                Pricing
              </Link>
              <Link href="/tools" className="tag">
                AI tools
              </Link>
              <Link href="/retrobuild" className="tag">
                RetroBuild
              </Link>
            </div>
          </div>
          <div style={{ borderRadius: 20, padding: 22, background: 'var(--vg-orange)', color: 'var(--vg-on-orange)' }}>
            <div className="mn" style={{ fontSize: 12, letterSpacing: '.12em', fontWeight: 600 }}>
              THE DAILY TOKEN
            </div>
            <h2 className="sf" style={{ fontSize: 30, lineHeight: 1.05, margin: '8px 0 14px', fontWeight: 400 }}>
              Five minutes. Every weekday.
            </h2>
            <NewsletterForm variant="orange" />
          </div>
        </aside>
      </section>
    </>
  );
}

function TopStories({ items, now }: { items: NewsListItem[]; now: Date }) {
  const [lead, ...second] = items;
  if (!lead) return null;
  return (
    <section aria-label="Top stories" className="wrap" style={{ paddingTop: 36, paddingBottom: 56, display: 'flex', flexWrap: 'wrap', gap: 40, borderBottom: line }}>
      <article className="st" style={{ flex: '1.6 1 520px', minWidth: 0 }}>
        <Link href={`/news/${lead.slug}`} style={{ display: 'block', color: 'var(--vg-ink)' }}>
          <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 18, overflow: 'hidden', border: line, background: '#151411' }}>
            <CoverArt seed={lead.slug} color={lead.cover.color} category={lead.category} />
            {lead.flag && (
              <span className="mn" style={flagBadge(lead.flag)}>
                {lead.flag.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mn" style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange)' }}>
            {lead.category.toUpperCase()} <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {ago(lead.publishedAt, now)}</span>
          </div>
          <h2 className="sf hl" style={{ fontSize: 'clamp(32px,3.4vw,48px)', lineHeight: 1.04, letterSpacing: '-.022em', margin: '10px 0' }}>
            {lead.title}
          </h2>
          <p style={{ margin: '0 0 12px', color: 'var(--vg-ink2)', fontSize: 17 }}>{lead.dek}</p>
          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={lead.author.name} color={lead.author.color} />
            {lead.author.name} · {lead.readingMinutes} min read
          </div>
        </Link>
      </article>
      <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {second.map((n) => (
          <article key={n.slug} className="st" style={{ paddingBottom: 22, borderBottom: line }}>
            <Link href={`/news/${n.slug}`} style={{ display: 'block', color: 'var(--vg-ink)' }}>
              <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange)' }}>
                {n.category.toUpperCase()} <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {ago(n.publishedAt, now)}</span>
              </div>
              <h3 className="sf hl" style={{ fontSize: 25, lineHeight: 1.12, margin: '8px 0' }}>
                {n.title}
              </h3>
              <p style={{ margin: '0 0 8px', color: 'var(--vg-ink2)', fontSize: 14 }}>{n.dek}</p>
              <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                {n.author.name} · {n.readingMinutes} min
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function RiverItem({ n, now }: { n: NewsListItem; now: Date }) {
  const t = timeAgo(n.publishedAt, now);
  return (
    <article className="st" style={{ borderTop: line }}>
      <Link href={`/news/${n.slug}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 22, padding: '24px 0', color: 'var(--vg-ink)' }}>
        <div className="mn" style={{ flex: '0 0 72px', fontSize: 12, color: 'var(--vg-ink3)', paddingTop: 3 }}>
          <time dateTime={n.publishedAt}>
            <b style={{ display: 'block', color: 'var(--vg-ink)', fontWeight: 500 }}>{t === 'now' ? 'Just' : t}</b>
            {t === 'now' ? 'now' : 'ago'}
          </time>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', color: 'var(--vg-orange)' }}>
            {n.category.toUpperCase()}
            {n.flag && (
              <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 5, background: n.flag === 'Analysis' ? 'var(--vg-sand)' : 'var(--vg-orange)', color: 'var(--vg-on-orange)' }}>
                {n.flag}
              </span>
            )}
          </div>
          <h3 className="sf hl" style={{ fontSize: 'clamp(22px,2vw,28px)', lineHeight: 1.14, margin: '8px 0' }}>
            {n.title}
          </h3>
          <p style={{ margin: '0 0 10px', color: 'var(--vg-ink2)' }}>{n.dek}</p>
          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={n.author.name} color={n.author.color} size={22} />
            {n.author.name} · {n.readingMinutes} min read
          </div>
        </div>
        <TypoCover cover={n.cover} size="md" style={{ flex: '0 0 200px', height: 125, maxWidth: '100%' }} />
      </Link>
    </article>
  );
}

function RiverSkeleton() {
  return (
    <div className="wrap" aria-hidden="true" style={{ paddingTop: 44, paddingBottom: 96 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 22, padding: '24px 0', borderTop: line }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 12, width: 90, borderRadius: 4, background: 'var(--vg-raised)' }} />
            <div style={{ height: 26, width: '80%', borderRadius: 6, background: 'var(--vg-raised)', margin: '12px 0' }} />
            <div style={{ height: 14, width: '60%', borderRadius: 4, background: 'var(--vg-surface)' }} />
          </div>
          <div style={{ width: 200, height: 125, borderRadius: 14, background: 'var(--vg-surface)' }} />
        </div>
      ))}
    </div>
  );
}

const ago = (iso: string, now: Date) => {
  const t = timeAgo(iso, now);
  return t === 'now' ? 'JUST NOW' : `${t.toUpperCase()} AGO`;
};

function flagBadge(flag: string): CSSProperties {
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
