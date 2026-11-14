import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound, permanentRedirect } from 'next/navigation';
import { TOOL_CATEGORIES, type ToolCategory } from '@vigas/core';
import { SiteHeader } from '@/components/site-header';
import { ToolsDirectory } from '@/components/tools/tools-directory';
import { Breadcrumb, Icon, JsonLd } from '@/components/ui';
import { getTools } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, faqLd, pageMetadata } from '@/lib/seo';
import { parseToolCategorySlug, TOOL_CATEGORY_SEO } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return TOOL_CATEGORIES.map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: PageProps<'/tools/category/[category]'>): Promise<Metadata> {
  const { category: raw } = await params;
  const cat = parseToolCategorySlug(raw);
  if (!cat) return { title: 'Category not found', robots: { index: false } };
  const seo = TOOL_CATEGORY_SEO[cat];
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/tools/category/${seo.slug}`,
  });
}

export default async function ToolsCategoryPage({
  params,
}: PageProps<'/tools/category/[category]'>) {
  const { category: raw } = await params;
  const cat = parseToolCategorySlug(raw);
  if (!cat) notFound();
  if (raw !== cat.toLowerCase()) permanentRedirect(`/tools/category/${cat.toLowerCase()}`);

  return (
    <>
      <SiteHeader active="tools" />
      <main id="main" className="wrap">
        <ToolCategoryView category={cat} />
      </main>
    </>
  );
}

async function ToolCategoryView({ category }: { category: ToolCategory }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');

  const tools = await getTools({ sort: 'votes' });
  const catTools = tools.filter((t) => t.category === category);
  const seo = TOOL_CATEGORY_SEO[category];
  const lbHref = seo.relatedLeaderboard === 'overall' ? '/leaderboard' : `/leaderboard/${seo.relatedLeaderboard}`;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
            { name: category, path: `/tools/category/${seo.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: seo.title,
            description: seo.description,
            url: absoluteUrl(`/tools/category/${seo.slug}`),
            mainEntity: {
              '@type': 'ItemList',
              name: `${category} AI tools`,
              numberOfItems: catTools.length,
              itemListElement: catTools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          ...(seo.faqs.length > 0 ? [faqLd(seo.faqs)] : []),
        ]}
      />
      <Breadcrumb
        items={[{ name: 'Home', href: '/' }, { name: 'Tools', href: '/tools' }, { name: category }]}
        style={{ paddingTop: 28 }}
      />
      <header style={{ padding: '22px 0 32px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div className="lbl">
            § Tools · {category} · {catTools.length} {catTools.length === 1 ? 'tool' : 'tools'}
          </div>
          <h1 className="sf" style={{ fontSize: 'clamp(42px,5.6vw,78px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '14px 0 14px' }}>
            {seo.heading} <em className="hi">{seo.accent}</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--vg-ink2)', maxWidth: 640, margin: 0 }}>{seo.intro}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={lbHref} className="btn gh">
            See related leaderboard
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      </header>

      <section aria-label={`${category} tools`} style={{ paddingBottom: 64 }}>
        <ToolsDirectory
          key={category}
          tools={tools}
          categories={TOOL_CATEGORIES}
          initialCategory={category}
          categoryMode="link"
        />
      </section>

      <section aria-labelledby="cat-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: '48px 0 88px', borderTop: '1px solid var(--vg-line)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="lbl">§ Related guides &amp; collections</div>
          <h2 id="cat-explore" className="sf" style={{ fontSize: 'clamp(30px,3.2vw,42px)', lineHeight: 1.04, margin: '10px 0 16px', letterSpacing: '-.02em' }}>
            Explore more <em className="hi">AI tools.</em>
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={lbHref} className="tag">
              Model leaderboard
            </Link>
            <Link href={`/news/category/${seo.relatedNewsCategory.toLowerCase()}`} className="tag">
              {seo.relatedNewsCategory} news
            </Link>
            <Link href="/tools/collection/free" className="tag">
              Free AI tools
            </Link>
            <Link href="/tools/collection/vigas-api" className="tag">
              Vigas API tools
            </Link>
            <Link href="/models" className="tag">
              API prices
            </Link>
          </div>
        </div>
        <div style={{ flex: '2 1 560px', minWidth: 0 }}>
          {seo.faqs.map((f) => (
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
    </>
  );
}
