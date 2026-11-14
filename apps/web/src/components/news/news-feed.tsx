import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import type { CSSProperties } from 'react';
import { NEWS_CATEGORIES, timeAgo, type NewsCategory, type NewsListItem } from '@vigas/core';
import { CoverArt, TypoCover } from '@/components/covers';
import { NewsletterForm } from '@/components/newsletter-form';
import { Avatar, Breadcrumb, Icon, JsonLd } from '@/components/ui';
import { getNews } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, faqLd } from '@/lib/seo';
import { NEWS_CATEGORY_SEO } from '@/lib/seo-catalog';

const PAGE_SIZE = 8;
/** Stories shown in the "Top stories" block on the first page of "All". */
const TOP = 4;

const line = '1px solid var(--vg-line)';

export function newsCategoryPath(category: NewsCategory | null, page = 1, lang: 'en' | 'fa' | null = null): string {
  const basePath = category
    ? page > 1
      ? `/news/category/${category.toLowerCase()}/page/${page}`
      : `/news/category/${category.toLowerCase()}`
    : page > 1
      ? `/news?page=${page}`
      : '/news';
  if (lang === 'en' || lang === 'fa') {
    return basePath.includes('?') ? `${basePath}&lang=${lang}` : `${basePath}?lang=${lang}`;
  }
  return basePath;
}

export async function NewsMasthead({ category = null }: { category?: NewsCategory | null }) {
  'use cache';
  cacheLife('content');
  cacheTag('news');

  const now = new Date();
  const { items, total } = await getNews({ category, limit: 20 });
  const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fresh = items.filter((n) => now.getTime() - new Date(n.publishedAt).getTime() < 86_400_000).length;
  const updated = items[0] ? timeAgo(items[0].publishedAt, now) : null;
  const catSeo = category ? NEWS_CATEGORY_SEO[category] : null;

  return (
    <header className="wrap" style={{ paddingTop: 28 }}>
      {category && (
        <Breadcrumb
          items={[
            { name: 'Home', href: '/' },
            { name: 'News', href: '/news' },
            { name: category },
          ]}
          style={{ marginBottom: 16 }}
        />
      )}
      <div className="masthead-head">
        <div>
          <div className="lbl" style={{ marginBottom: 10 }}>
            § Vigas Newsroom{category ? ` · ${category}` : ''}
          </div>
          <h1 className="sf" style={{ fontSize: 'clamp(52px,10vw,150px)', lineHeight: 0.86, letterSpacing: '-.045em', margin: 0 }}>
            {category ? (
              <>
                AI <em className="hi">{category}</em>
              </>
            ) : (
              <>
                AI <em className="hi">News</em>
              </>
            )}
          </h1>
          {catSeo && (
            <p style={{ margin: '14px 0 0', fontSize: 16, color: 'var(--vg-ink2)', maxWidth: 640 }}>
              {catSeo.intro}
            </p>
          )}
        </div>
        <div className="mn masthead-meta">
          {today}
          <br />
          {updated ? `Updated ${updated === 'now' ? 'just now' : `${updated} ago`} · ` : ''}
          {total === 0 ? 'Editorial desk ready for first dispatch' : `${fresh} new ${fresh === 1 ? 'story' : 'stories'} today · ${total} in total`}
        </div>
      </div>
    </header>
  );
}

export async function NewsContent({
  category,
  page,
  lang = null,
}: {
  category: NewsCategory | null;
  page: number;
  lang?: 'en' | 'fa' | null;
}) {
  'use cache';
  cacheLife('content');
  cacheTag('news');

  const now = new Date();
  const showTop = !category && page === 1;
  const skip = category ? 0 : TOP;
  const [river, top, analysis, pool] = await Promise.all([
    getNews({ category, lang, limit: PAGE_SIZE, offset: skip + (page - 1) * PAGE_SIZE }),
    showTop ? getNews({ lang, limit: TOP }) : Promise.resolve(null),
    showTop ? getNews({ category: 'Analysis', lang, limit: 3 }) : Promise.resolve(null),
    getNews({ lang, limit: 30 }),
  ]);

  const pages = Math.max(1, Math.ceil(Math.max(0, river.total - skip) / PAGE_SIZE));
  const longReads = [...pool.items].sort((a, b) => b.readingMinutes - a.readingMinutes).slice(0, 5);
  const brief = pool.items.slice(0, 4);
  const listed = [...(top?.items ?? []), ...river.items];
  const catSeo = category ? NEWS_CATEGORY_SEO[category] : null;
  const sectionUrl = absoluteUrl(newsCategoryPath(category, 1, lang));

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'News', path: newsCategoryPath(null, 1, lang) },
    ...(category ? [{ name: category, path: newsCategoryPath(category, 1, lang) }] : []),
  ];

  const jsonLdItems = [
    breadcrumbLd(crumbs),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: catSeo
        ? catSeo.title
        : lang === 'fa'
          ? 'اخبار هوش مصنوعی ویگاس — فارسی'
          : 'AI News — models, agents, policy and funding',
      description: catSeo ? catSeo.description : 'AI news from the Vigas Newsroom: model launches, agents, inference prices, policy, hardware and funding.',
      url: sectionUrl,
      inLanguage: lang ?? ['en', 'fa'],
      mainEntity: {
        '@type': 'ItemList',
        name: category ? `${category} AI news` : 'AI news',
        numberOfItems: listed.length,
        itemListElement: listed.map((n, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(`/news/${n.slug}`),
          name: n.title,
        })),
      },
    },
    ...(catSeo && catSeo.faqs.length > 0 ? [faqLd(catSeo.faqs)] : []),
  ];

  return (
    <>
      <JsonLd data={jsonLdItems} />
      <nav aria-label="News sections" style={{ borderBottom: line, background: 'rgba(18,17,15,.92)' }}>
        <div
          className="wrap"
          style={{
            paddingTop: 12,
            paddingBottom: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div className="scroll-x" style={{ display: 'flex', gap: 6, flex: '1 1 520px', minWidth: 0 }}>
            <Link href={newsCategoryPath(null, 1, lang)} className="chip" aria-current={!category ? 'page' : undefined} style={{ minHeight: 38, padding: '0 15px' }}>
              All
            </Link>
            {NEWS_CATEGORIES.map((c) => (
              <Link key={c} href={newsCategoryPath(c)} className="chip" aria-current={category === c ? 'page' : undefined} style={{ minHeight: 38, padding: '0 15px' }}>
                {c}
              </Link>
            ))}
          </div>
          <div role="group" aria-label="Article language" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Link href={newsCategoryPath(null, 1, null)} className="chip" aria-current={!category && !lang ? 'page' : undefined} style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}>
              All languages
            </Link>
            <Link href={newsCategoryPath(null, 1, 'en')} className="chip" aria-current={lang === 'en' ? 'page' : undefined} style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}>
              English
            </Link>
            <Link
              href={newsCategoryPath(null, 1, 'fa')}
              className="chip fa-ui"
              dir="rtl"
              lang="fa"
              aria-current={lang === 'fa' ? 'page' : undefined}
              style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
            >
              فارسی
            </Link>
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 16 }}>
            {analysis.items.map((x) => {
              const xFa = x.lang === 'fa';
              return (
                <Link
                  key={x.slug}
                  href={`/news/${x.slug}`}
                  dir={xFa ? 'rtl' : 'ltr'}
                  lang={x.lang ?? 'en'}
                  className={xFa ? 'st card fa-ui' : 'st card'}
                  style={{ borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 280, color: 'var(--vg-ink)' }}
                >
                  <span className="sf" aria-hidden="true" style={{ fontSize: 72, lineHeight: 0.5, height: 28, color: 'var(--vg-sand)' }}>
                    {xFa ? '«' : '“'}
                  </span>
                  <h3
                    className={xFa ? 'hl fa-ui' : 'sf hl'}
                    style={{
                      fontSize: xFa ? 21 : 27,
                      lineHeight: xFa ? 1.45 : 1.14,
                      margin: 0,
                      fontWeight: xFa ? 600 : 400,
                    }}
                  >
                    {x.title}
                  </h3>
                  <span style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <Avatar name={x.author.name} color={x.author.color} size={32} />
                    <span>
                      <b style={{ fontWeight: 500, display: 'block' }}>{x.author.name}</b>
                      <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                        {xFa ? `${x.readingMinutes} دقیقه مطالعه` : `${x.readingMinutes} min read`}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="wrap" style={{ paddingTop: 44, paddingBottom: 96, display: 'flex', flexWrap: 'wrap', gap: 44 }}>
        <div style={{ flex: '999 1 600px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 className="sf" style={{ fontSize: 34, margin: 0, fontWeight: 400, letterSpacing: '-.015em' }}>
              Latest · <em className="hi">{category ?? 'all sections'}</em>
              {lang === 'fa' && (
                <span className="fa-ui" style={{ fontSize: 16, marginLeft: 10, color: 'var(--vg-sand)', verticalAlign: 'middle' }}>
                  (فارسی)
                </span>
              )}
              {lang === 'en' && (
                <span className="mn" style={{ fontSize: 13, marginLeft: 10, color: 'var(--vg-ink3)', verticalAlign: 'middle' }}>
                  (EN)
                </span>
              )}
            </h2>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {river.total} {river.total === 1 ? 'story' : 'stories'}
              {pages > 1 ? ` · page ${page} of ${pages}` : ''}
            </span>
          </div>
          {river.items.length === 0 ? (
            <div style={{ padding: '44px 0', color: 'var(--vg-ink2)', borderTop: line }}>
              <h3 className={lang === 'fa' ? 'fa-ui' : 'sf'} dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ fontSize: lang === 'fa' ? 24 : 30, margin: '0 0 10px', fontWeight: lang === 'fa' ? 700 : 400, color: 'var(--vg-ink)' }}>
                {page > 1
                  ? 'No more stories on this page.'
                  : lang === 'fa'
                    ? 'هنوز خبری با این فیلتر به زبان فارسی منتشر نشده است.'
                    : category
                      ? `No ${category.toLowerCase()} dispatches published yet.`
                      : 'No articles published yet.'}
              </h3>
              <p dir={lang === 'fa' ? 'rtl' : 'ltr'} className={lang === 'fa' ? 'fa-ui' : undefined} style={{ margin: '0 0 20px', maxWidth: 560, lineHeight: 1.7 }}>
                {page > 1
                  ? 'Head back to the first page to see published stories.'
                  : lang === 'fa'
                    ? 'می‌توانید فیلتر زبان را روی همه زبان‌ها بگذارید یا سایر بخش‌های تحریریه ویگاس را مرور کنید.'
                    : 'Vigas Newsroom publishes real reporting paired with live model leaderboards, API pricing moves, and builder tools.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {lang && (
                  <Link href={newsCategoryPath(category, 1, null)} className="btn gh">
                    Show all languages
                  </Link>
                )}
                {page > 1 ? (
                  <Link href={newsCategoryPath(category, 1, lang)} className="btn gh">
                    Back to latest stories
                  </Link>
                ) : category ? (
                  <Link href={newsCategoryPath(null, 1, lang)} className="btn gh">
                    All news sections
                  </Link>
                ) : null}
                <Link href="/leaderboard" className="btn key">
                  Explore live leaderboard
                  <Icon name="arrow" size={16} />
                </Link>
                <Link href="/tools" className="btn gh">
                  Browse AI tools
                </Link>
              </div>
            </div>
          ) : (
            river.items.map((n) => <RiverItem key={n.slug} n={n} now={now} />)
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderTop: line, paddingTop: 22 }}>
              {page < pages ? (
                <Link href={newsCategoryPath(category, page + 1, lang)} className="btn key" rel="next">
                  More stories
                  <Icon name="arrow" size={16} />
                </Link>
              ) : (
                <Link href={newsCategoryPath(category, page - 1, lang)} className="btn gh" rel="prev">
                  Newer stories
                </Link>
              )}
              <span className="mn" style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={newsCategoryPath(category, p, lang)}
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

          {catSeo && catSeo.faqs.length > 0 && (
            <section aria-labelledby="cat-faq" style={{ marginTop: 48, paddingTop: 32, borderTop: line }}>
              <div className="lbl">§ About {category} coverage</div>
              <h2 id="cat-faq" className="sf" style={{ fontSize: 30, margin: '8px 0 12px', fontWeight: 400 }}>
                {catSeo.heading}
              </h2>
              {catSeo.faqs.map((f) => (
                <details key={f.q} style={{ borderTop: '1px solid rgba(239,234,225,.1)' }}>
                  <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '15px 0', fontWeight: 500 }}>
                    <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                    <Icon name="plus" size={18} className="pm" style={{ color: 'var(--vg-orange)' }} />
                  </summary>
                  <p style={{ margin: '0 0 16px', color: 'var(--vg-ink2)', lineHeight: 1.6 }}>{f.a}</p>
                </details>
              ))}
            </section>
          )}
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }} aria-label="More from the newsroom">
          {brief.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <div className="lbl">§ The brief</div>
              <h2 className="sf" style={{ fontSize: 26, margin: '6px 0 12px', fontWeight: 400 }}>
                In 60 seconds
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--vg-ink2)', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {brief.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/news/${n.slug}`} style={{ color: 'var(--vg-ink2)' }}>
                      <bdi dir={n.lang === 'fa' ? 'rtl' : 'ltr'} lang={n.lang ?? 'en'} className={n.lang === 'fa' ? 'fa-ui' : undefined}>
                        {n.title}
                      </bdi>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/chat?q=${encodeURIComponent('Summarize today’s AI news in five bullet points.')}`} className="btn gh" style={{ width: '100%', marginTop: 16 }}>
                <Icon name="chat" size={16} />
                Ask Vigas about today’s news
              </Link>
            </div>
          )}

          {longReads.length > 0 && (
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
                        <bdi dir={m.lang === 'fa' ? 'rtl' : 'ltr'} lang={m.lang ?? 'en'} className={m.lang === 'fa' ? 'fa-ui' : undefined}>
                          {m.title}
                        </bdi>{' '}
                        <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>· {m.readingMinutes} min</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card" style={{ padding: 22 }}>
            <h2 className="lbl" style={{ margin: '0 0 12px' }}>
              § Topics &amp; sections
            </h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NEWS_CATEGORIES.map((c) => (
                <Link key={c} href={newsCategoryPath(c, 1, lang)} className="tag">
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
              {catSeo && (
                <Link href={`/tools/category/${catSeo.relatedToolCategory.toLowerCase()}`} className="tag">
                  {catSeo.relatedToolCategory} tools
                </Link>
              )}
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

export function NewsRiverSkeleton() {
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

function TopStories({ items, now }: { items: NewsListItem[]; now: Date }) {
  const [lead, ...second] = items;
  if (!lead) return null;
  const leadFa = lead.lang === 'fa';
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
          <div dir={leadFa ? 'rtl' : 'ltr'} lang={lead.lang ?? 'en'} className={leadFa ? 'fa-ui' : undefined}>
            <div className="mn" style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: leadFa ? 0 : '.1em', color: 'var(--vg-orange)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{leadFa ? (FA_CATEGORIES[lead.category] ?? lead.category) : lead.category.toUpperCase()}</span>
              {leadFa && (
                <span className="fa-ui" style={{ padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(227,182,92,.4)', color: 'var(--vg-sand)', fontSize: 11 }}>
                  فارسی
                </span>
              )}
              <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {ago(lead.publishedAt, now, leadFa)}</span>
            </div>
            <h2
              className={leadFa ? 'hl fa-ui' : 'sf hl'}
              style={{
                fontSize: leadFa ? 'clamp(26px,2.8vw,36px)' : 'clamp(32px,3.4vw,48px)',
                lineHeight: leadFa ? 1.38 : 1.04,
                letterSpacing: leadFa ? 0 : '-.022em',
                margin: '10px 0',
                fontWeight: leadFa ? 700 : 400,
              }}
            >
              {lead.title}
            </h2>
            <p style={{ margin: '0 0 12px', color: 'var(--vg-ink2)', fontSize: leadFa ? 15.5 : 17, lineHeight: leadFa ? 1.7 : 1.55 }}>{lead.dek}</p>
            <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={lead.author.name} color={lead.author.color} />
              {lead.author.name} · {leadFa ? `${lead.readingMinutes} دقیقه مطالعه` : `${lead.readingMinutes} min read`}
            </div>
          </div>
        </Link>
      </article>
      <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {second.map((n) => {
          const isFa = n.lang === 'fa';
          return (
            <article key={n.slug} className="st" dir={isFa ? 'rtl' : 'ltr'} lang={n.lang ?? 'en'} style={{ paddingBottom: 22, borderBottom: line }}>
              <Link href={`/news/${n.slug}`} className={isFa ? 'fa-ui' : undefined} style={{ display: 'block', color: 'var(--vg-ink)' }}>
                <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: isFa ? 0 : '.1em', color: 'var(--vg-orange)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{isFa ? (FA_CATEGORIES[n.category] ?? n.category) : n.category.toUpperCase()}</span>
                  {isFa && (
                    <span className="fa-ui" style={{ padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(227,182,92,.4)', color: 'var(--vg-sand)', fontSize: 11 }}>
                      فارسی
                    </span>
                  )}
                  <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {ago(n.publishedAt, now, isFa)}</span>
                </div>
                <h3
                  className={isFa ? 'hl fa-ui' : 'sf hl'}
                  style={{
                    fontSize: isFa ? 20 : 25,
                    lineHeight: isFa ? 1.42 : 1.12,
                    margin: '8px 0',
                    fontWeight: isFa ? 600 : 400,
                  }}
                >
                  {n.title}
                </h3>
                <p style={{ margin: '0 0 8px', color: 'var(--vg-ink2)', fontSize: 14, lineHeight: isFa ? 1.7 : 1.5 }}>{n.dek}</p>
                <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                  {n.author.name} · {isFa ? `${n.readingMinutes} دقیقه` : `${n.readingMinutes} min`}
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RiverItem({ n, now }: { n: NewsListItem; now: Date }) {
  const t = timeAgo(n.publishedAt, now);
  const isFa = n.lang === 'fa';
  return (
    <article className="st" style={{ borderTop: line }}>
      <Link href={`/news/${n.slug}`} className="river-link">
        <div className="mn river-date">
          <time dateTime={n.publishedAt}>
            <b style={{ display: 'block', color: 'var(--vg-ink)', fontWeight: 500 }}>{t === 'now' ? 'Just' : t}</b>
            {t === 'now' ? 'now' : 'ago'}
          </time>
        </div>
        <div dir={isFa ? 'rtl' : 'ltr'} lang={n.lang ?? 'en'} className={isFa ? 'fa-ui' : undefined} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="mn" style={{ fontSize: 12, fontWeight: 600, letterSpacing: isFa ? 0 : '.1em', color: 'var(--vg-orange)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{isFa ? (FA_CATEGORIES[n.category] ?? n.category) : n.category.toUpperCase()}</span>
            {n.flag && (
              <span style={{ padding: '1px 7px', borderRadius: 5, background: n.flag === 'Analysis' ? 'var(--vg-sand)' : 'var(--vg-orange)', color: 'var(--vg-on-orange)' }}>
                {n.flag}
              </span>
            )}
            {isFa && (
              <span className="fa-ui" style={{ padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(227,182,92,.4)', color: 'var(--vg-sand)', fontSize: 11 }}>
                فارسی
              </span>
            )}
          </div>
          <h3
            className={isFa ? 'hl fa-ui' : 'sf hl'}
            style={{
              fontSize: isFa ? 'clamp(19px,1.9vw,23px)' : 'clamp(22px,2vw,28px)',
              lineHeight: isFa ? 1.45 : 1.14,
              margin: '8px 0',
              fontWeight: isFa ? 600 : 400,
            }}
          >
            {n.title}
          </h3>
          <p style={{ margin: '0 0 10px', color: 'var(--vg-ink2)', lineHeight: isFa ? 1.75 : 1.55 }}>{n.dek}</p>
          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={n.author.name} color={n.author.color} size={22} />
            {n.author.name} · {isFa ? `${n.readingMinutes} دقیقه مطالعه` : `${n.readingMinutes} min read`}
          </div>
        </div>
        <TypoCover cover={n.cover} size="md" className="river-cover" />
      </Link>
    </article>
  );
}

const FA_CATEGORIES: Record<string, string> = {
  Models: 'مدل‌ها',
  Agents: 'ایجنت‌ها',
  Analysis: 'تحلیل',
  Policy: 'سیاست‌گذاری',
  Hardware: 'سخت‌افزار',
  Funding: 'سرمایه‌گذاری',
  Tools: 'ابزارها',
};

const ago = (iso: string, now: Date, isFa = false) => {
  const t = timeAgo(iso, now);
  if (!isFa) return t === 'now' ? 'JUST NOW' : `${t.toUpperCase()} AGO`;
  if (t === 'now') return 'هم‌اکنون';
  const m = /^(\d+)\s*(min|m|h|d|w)$/i.exec(t);
  if (!m) return t;
  const units: Record<string, string> = { min: 'دقیقه پیش', m: 'دقیقه پیش', h: 'ساعت پیش', d: 'روز پیش', w: 'هفته پیش' };
  const faDigits = m[1]!.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
  return `${faDigits} ${units[m[2]!.toLowerCase()] ?? ''}`;
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
