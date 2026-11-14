import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { TOOL_CATEGORIES, type ToolItem } from '@vigas/core';
import { SiteHeader } from '@/components/site-header';
import { ToolsDirectory } from '@/components/tools/tools-directory';
import { Breadcrumb, Icon, JsonLd, ToolMark } from '@/components/ui';
import { getTools } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, faqLd, pageMetadata } from '@/lib/seo';
import { getToolsDirectoryFaq } from '@/lib/seo-catalog';

export const metadata = pageMetadata({
  title: 'Best AI tools of 2026 — curated app directory',
  description:
    'Discover verified AI coding agents, research workspaces, image studios, video generators, voice tools, and productivity apps on Vigas — tested and upvoted by builders.',
  path: '/tools',
});

export default async function ToolsPage() {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');
  const tools = await getTools({ sort: 'votes' });
  const collections: Array<{ t: string; href: string; items: ToolItem[] }> = [
    { t: 'Best AI coding tools in 2026', href: '/tools/category/coding', items: tools.filter((t) => t.category === 'Coding') },
    { t: 'Best AI image generators', href: '/tools/category/image', items: tools.filter((t) => t.category === 'Image') },
    { t: 'Free AI tools worth using', href: '/tools/collection/free', items: tools.filter((t) => t.pricing !== 'Paid') },
    { t: 'Best AI voice & music tools', href: '/tools/category/audio', items: tools.filter((t) => t.category === 'Audio') },
    { t: 'AI research assistants', href: '/tools/category/research', items: tools.filter((t) => t.category === 'Research') },
    { t: 'Apps running on Vigas API', href: '/tools/collection/vigas-api', items: tools.filter((t) => t.runsOnVigas) },
  ].filter((c) => c.items.length > 0);
  const faqItems = getToolsDirectoryFaq(tools);

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
            '@type': 'CollectionPage',
            name: 'Best AI tools of 2026',
            description:
              'Curated directory of AI coding, research, image, video, audio, and agent apps ranked by builder upvotes on Vigas.',
            url: absoluteUrl('/tools'),
            mainEntity: {
              '@type': 'ItemList',
              name: 'AI tools directory',
              numberOfItems: tools.length,
              itemListElement: tools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          faqLd(faqItems),
        ]}
      />
      <SiteHeader active="tools" />
      <main id="main" className="wrap">
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Tools' }]} style={{ paddingTop: 18 }} />
        <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="sf" style={{ fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1, letterSpacing: '-.025em', margin: 0 }}>
              AI <em className="hi">tools</em>
            </h1>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {`${tools.length} verified apps · ranked by builders`}
            </span>
          </div>
          <a href="#submit" className="btn gh" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
            <Icon name="plus" size={15} />
            Submit app
          </a>
        </header>

        <section id="dir" aria-label="AI tools directory" style={{ paddingBottom: 56, scrollMarginTop: 24 }}>
          <ToolsDirectory tools={tools} categories={TOOL_CATEGORIES} />
        </section>

        <section aria-labelledby="col" style={{ padding: '44px 0 48px', borderTop: '1px solid var(--vg-line)' }}>
          <div className="lbl">§ Collections &amp; guides</div>
          <h2 id="col" className="sf" style={{ fontSize: 'clamp(28px,3vw,38px)', margin: '8px 0 18px', letterSpacing: '-.02em', lineHeight: 1.04 }}>
            Browse by <em className="hi">workflow.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(270px,100%),1fr))', gap: 12 }}>
            {collections.map((c) => (
              <Link key={c.t} href={c.href} className="lift card" style={{ display: 'flex', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, color: 'var(--vg-ink)' }}>
                <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
                  {c.items.slice(0, 3).map((s) => (
                    <ToolMark
                      key={s.slug}
                      slug={s.slug}
                      iconUrl={s.iconUrl}
                      color={s.color}
                      letter={s.letter}
                      size={30}
                      radius={9}
                      fontSize={14}
                      style={{ marginRight: -6, borderWidth: 2, borderColor: 'var(--vg-surface)' }}
                    />
                  ))}
                </span>
                <span style={{ minWidth: 0, marginLeft: 6 }}>
                  <b style={{ display: 'block', fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>
                    {c.t}
                  </b>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {c.items.length} {c.items.length === 1 ? 'app' : 'apps'}
                  </span>
                </span>
                <Icon name="chevRight" size={16} style={{ marginLeft: 'auto', color: 'var(--vg-ink3)' }} />
              </Link>
            ))}
          </div>
          <nav aria-label="Browse tools by category" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {TOOL_CATEGORIES.map((c) => (
              <Link key={c} href={`/tools/category/${c.toLowerCase()}`} className="tag">
                {c} tools
              </Link>
            ))}
            <Link href="/tools/collection/free" className="tag">
              Free AI tools
            </Link>
            <Link href="/tools/collection/vigas-api" className="tag">
              Vigas API apps
            </Link>
            <Link href="/tools/collection/new" className="tag">
              New launches
            </Link>
          </nav>
        </section>

        <section aria-labelledby="tools-faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '40px 0 56px', borderTop: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div className="lbl">§ About this directory</div>
            <h2 id="tools-faq" className="sf" style={{ fontSize: 'clamp(28px,3vw,40px)', lineHeight: 1.04, margin: '8px 0 10px', letterSpacing: '-.02em' }}>
              Curated <em className="hi">AI apps FAQ.</em>
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)', maxWidth: 380 }}>
              Every application is manually reviewed by Vigas editors, tagged with verified pricing, and sorted by real community upvotes.
            </p>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {faqItems.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid rgba(239,234,225,.1)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680 }}>{f.a}</p>
              </details>
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
