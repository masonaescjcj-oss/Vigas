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
        style={{ paddingTop: 18 }}
      />
      <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="sf" style={{ fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1, letterSpacing: '-.025em', margin: 0 }}>
            {category} <em className="hi">AI tools</em>
          </h1>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {catTools.length} {catTools.length === 1 ? 'app' : 'apps'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={lbHref} className="btn gh" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
            Leaderboard
            <Icon name="arrow" size={14} />
          </Link>
        </div>
      </header>

      <section aria-label={`${category} tools`} style={{ paddingBottom: 56 }}>
        <ToolsDirectory
          key={category}
          tools={tools}
          categories={TOOL_CATEGORIES}
          initialCategory={category}
          categoryMode="link"
        />
      </section>

      <section aria-labelledby="cat-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 36, padding: '44px 0 84px', borderTop: '1px solid var(--vg-line)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="lbl">§ {category} guide &amp; links</div>
          <h2 id="cat-explore" className="sf" style={{ fontSize: 'clamp(28px,3vw,38px)', lineHeight: 1.04, margin: '8px 0 12px', letterSpacing: '-.02em' }}>
            {seo.heading} <em className="hi">{seo.accent}</em>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--vg-ink2)', margin: '0 0 18px', maxWidth: 460 }}>{seo.intro}</p>
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
