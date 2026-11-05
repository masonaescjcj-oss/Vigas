import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { TOOL_CATEGORIES, type ToolItem } from '@vigas/core';
import { SiteHeader } from '@/components/site-header';
import { ToolsDirectory } from '@/components/tools/tools-directory';
import { Breadcrumb, Icon, JsonLd, Mark } from '@/components/ui';
import { getTools } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Best AI tools of 2026 — reviewed and ranked by builders',
  description:
    'The AI tools directory: trending and new AI tools for coding, research, images, video, audio and productivity — upvoted by builders, with tools that run on the Vigas API.',
  path: '/tools',
});

const HEAT = ['#24221F', '#3A2618', '#6B3214', '#A8420C', '#FF6A1A'];

/** Deterministic pseudo-random "weekly activity" heatmap for the tool-of-the-week art. */
function heatmap(): string[] {
  let a = 42 * 9301 + 49297;
  const rnd = () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  return Array.from({ length: 84 }, () => HEAT[Math.floor(rnd() * rnd() * 5.4)]!);
}

export default async function ToolsPage() {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');
  const tools = await getTools({ sort: 'votes' });
  const trending = tools.slice(0, 6);
  const featured = tools.find((t) => t.slug === 'retrobuild') ?? tools[0];
  const collections: Array<{ t: string; href: string; items: ToolItem[] }> = [
    { t: 'Best AI coding tools in 2026', href: '/tools?category=Coding#dir', items: tools.filter((t) => t.category === 'Coding') },
    { t: 'Best AI image generators', href: '/tools?category=Image#dir', items: tools.filter((t) => t.category === 'Image') },
    { t: 'Free AI tools that are actually good', href: '/tools?pricing=Free#dir', items: tools.filter((t) => t.pricing !== 'Paid') },
    { t: 'Best AI voice & music tools', href: '/tools?category=Audio#dir', items: tools.filter((t) => t.category === 'Audio') },
    { t: 'AI research assistants', href: '/tools?category=Research#dir', items: tools.filter((t) => t.category === 'Research') },
    { t: 'Tools that run on the Vigas API', href: '/tools?vigas=1#dir', items: tools.filter((t) => t.runsOnVigas) },
  ].filter((c) => c.items.length > 0);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'AI tools directory',
            numberOfItems: tools.length,
            itemListElement: tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/tools/${t.slug}`), name: t.name })),
          },
        ]}
      />
      <SiteHeader active="tools" />
      <main id="main" className="wrap">
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Tools' }]} style={{ paddingTop: 28 }} />
        <header style={{ padding: '22px 0 30px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>
            <div className="lbl">§ Tools directory · {tools.length} tools · updated daily</div>
            <h1 className="sf" style={{ fontSize: 'clamp(46px,6vw,84px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '16px 0 14px' }}>
              The best <em className="hi">AI tools,</em>
              <br />
              ranked by builders.
            </h1>
            <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 560, margin: 0 }}>
              Hand-picked by our editors and upvoted by builders. See what’s new, what’s rising and what’s worth paying for.
            </p>
          </div>
          <a href="#submit" className="btn gh">
            <Icon name="plus" size={16} />
            Submit a tool
          </a>
        </header>

        <section aria-labelledby="tr" style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Icon name="flame" size={18} style={{ color: 'var(--vg-orange)' }} />
            <h2 id="tr" className="sf" style={{ fontSize: 30, margin: 0, fontWeight: 400 }}>
              Trending this week
            </h2>
          </div>
          <ol className="scroll-x" style={{ listStyle: 'none', margin: 0, padding: '0 0 6px', display: 'flex', gap: 12 }}>
            {trending.map((t, i) => (
              <li key={t.slug} style={{ flex: '0 0 250px' }}>
                <Link
                  href={`/tools/${t.slug}`}
                  className="lift card"
                  style={{ height: '100%', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--vg-ink)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="sf" aria-hidden="true" style={{ fontSize: 40, lineHeight: 0.9, color: i === 0 ? 'var(--vg-orange)' : 'var(--vg-pillar)' }}>
                      0{i + 1}
                    </span>
                    {t.isNew ? (
                      <span className="mn" style={{ fontSize: 12, padding: '2px 7px', borderRadius: 5, background: 'var(--vg-sand)', color: 'var(--vg-on-orange)' }}>
                        NEW
                      </span>
                    ) : (
                      <span className="mn" style={{ fontSize: 12, padding: '2px 7px', borderRadius: 5, background: 'var(--vg-raised)', color: 'var(--vg-green)' }}>
                        ★ {t.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Mark color={t.color} letter={t.letter} size={40} radius={11} fontSize={19} />
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', fontWeight: 600 }}>{t.name}</b>
                      <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                        {t.category} · ▲ {t.votes.toLocaleString('en-US')}
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {featured && (
          <section
            aria-labelledby="totw"
            style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid rgba(255,106,26,.32)', borderRadius: 26, overflow: 'hidden', background: 'var(--vg-surface)', marginBottom: 56 }}
          >
            <div
              aria-hidden="true"
              style={{
                flex: '1.1 1 420px',
                minHeight: 300,
                position: 'relative',
                background: '#151411',
                display: 'grid',
                gridTemplateColumns: 'repeat(12,minmax(0,1fr))',
                gap: 6,
                padding: 28,
                alignContent: 'center',
              }}
            >
              {heatmap().map((c, i) => (
                <span key={i} style={{ aspectRatio: '1', borderRadius: 5, background: c }} />
              ))}
              <span
                className="mn"
                style={{ position: 'absolute', left: 16, top: 16, fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: 'var(--vg-orange)', color: 'var(--vg-on-orange)', letterSpacing: '.06em' }}
              >
                TOOL OF THE WEEK
              </span>
            </div>
            <div style={{ flex: '1 1 380px', minWidth: 0, padding: 'clamp(22px,3vw,40px)', display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Mark color={featured.color} letter={featured.letter} size={48} radius={13} fontSize={22} />
                <span>
                  <b style={{ fontSize: 17, fontWeight: 600, display: 'block' }}>{featured.name}</b>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {featured.category} · {featured.pricing} · ★ {featured.rating.toFixed(1)}
                  </span>
                </span>
              </div>
              <h2 id="totw" className="sf" style={{ fontSize: 'clamp(34px,3.6vw,50px)', lineHeight: 1.02, letterSpacing: '-.02em', margin: 0 }}>
                {featured.slug === 'retrobuild' ? (
                  <>
                    Describe an app.
                    <br />
                    <em className="hi">Ship it tonight.</em>
                  </>
                ) : (
                  featured.tagline
                )}
              </h2>
              <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>{featured.description}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={featured.slug === 'retrobuild' ? '/retrobuild' : featured.url} className="btn key">
                  Try {featured.name}
                </Link>
                <Link href={`/tools/${featured.slug}`} className="btn gh">
                  Read the review
                </Link>
              </div>
            </div>
          </section>
        )}

        <section id="dir" aria-labelledby="dh" style={{ paddingBottom: 64, scrollMarginTop: 24 }}>
          <h2 id="dh" className="sf" style={{ fontSize: 'clamp(32px,3.4vw,46px)', margin: '0 0 18px', letterSpacing: '-.02em', lineHeight: 1.04 }}>
            The directory
          </h2>
          <ToolsDirectory tools={tools} categories={TOOL_CATEGORIES} />
        </section>

        <section aria-labelledby="col" style={{ paddingBottom: 64 }}>
          <div className="lbl">§ Collections</div>
          <h2 id="col" className="sf" style={{ fontSize: 'clamp(32px,3.4vw,46px)', margin: '10px 0 22px', letterSpacing: '-.02em', lineHeight: 1.04 }}>
            Hand-picked <em className="hi">shortlists.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 14 }}>
            {collections.map((c) => (
              <a key={c.t} href={c.href} className="lift card" style={{ display: 'flex', alignItems: 'center', gap: 16, borderRadius: 18, padding: 18, color: 'var(--vg-ink)' }}>
                <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
                  {c.items.slice(0, 3).map((s) => (
                    <span
                      key={s.slug}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        font: '400 16px var(--vg-font-serif)',
                        marginRight: -8,
                        border: '2px solid var(--vg-surface)',
                        background: 'var(--vg-raised)',
                        color: s.color,
                      }}
                    >
                      {s.letter}
                    </span>
                  ))}
                </span>
                <span style={{ minWidth: 0, marginLeft: 8 }}>
                  <b className="sf" style={{ display: 'block', fontSize: 21, fontWeight: 400, lineHeight: 1.15 }}>
                    {c.t}
                  </b>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {c.items.length} {c.items.length === 1 ? 'tool' : 'tools'}
                  </span>
                </span>
                <Icon name="chevRight" size={18} style={{ marginLeft: 'auto', color: 'var(--vg-ink3)' }} />
              </a>
            ))}
          </div>
        </section>

        <section
          id="submit"
          aria-labelledby="submit-title"
          style={{
            marginBottom: 96,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'clamp(22px,3vw,40px)',
            borderRadius: 24,
            background: 'var(--vg-orange)',
            color: 'var(--vg-on-orange)',
            scrollMarginTop: 24,
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <h2 id="submit-title" className="sf" style={{ fontSize: 'clamp(32px,3.4vw,46px)', margin: 0, lineHeight: 1.04, fontWeight: 400 }}>
              Built something people should know about?
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 16, maxWidth: 560 }}>
              Submit your tool. Our editors test every submission, and the best ones make the weekly newsletter.
            </p>
          </div>
          <a href="mailto:tools@vigas.ai?subject=Tool%20submission" className="btn dark-btn" style={{ minHeight: 52, padding: '0 26px', fontSize: 15 }}>
            Submit a tool
          </a>
        </section>
      </main>
    </>
  );
}
