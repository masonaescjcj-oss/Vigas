import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound, permanentRedirect } from 'next/navigation';
import { TOOL_CATEGORIES } from '@vigas/core';
import { SiteHeader } from '@/components/site-header';
import { ToolsDirectory } from '@/components/tools/tools-directory';
import { Breadcrumb, Icon, JsonLd } from '@/components/ui';
import { getTools } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd, faqLd, pageMetadata } from '@/lib/seo';
import { parseToolCollectionSlug, TOOL_COLLECTIONS, type ToolCollectionSlug } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return (Object.keys(TOOL_COLLECTIONS) as ToolCollectionSlug[]).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/tools/collection/[slug]'>): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = parseToolCollectionSlug(raw);
  if (!slug) return { title: 'Collection not found', robots: { index: false } };
  const col = TOOL_COLLECTIONS[slug];
  return pageMetadata({
    title: col.title,
    description: col.description,
    path: `/tools/collection/${col.slug}`,
  });
}

export default async function ToolsCollectionPage({
  params,
}: PageProps<'/tools/collection/[slug]'>) {
  const { slug: raw } = await params;
  const slug = parseToolCollectionSlug(raw);
  if (!slug) notFound();
  if (raw !== slug) permanentRedirect(`/tools/collection/${slug}`);

  return (
    <>
      <SiteHeader active="tools" />
      <main id="main" className="wrap">
        <ToolCollectionView slug={slug} />
      </main>
    </>
  );
}

async function ToolCollectionView({ slug }: { slug: ToolCollectionSlug }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');

  const tools = await getTools({ sort: 'votes' });
  const col = TOOL_COLLECTIONS[slug];
  const colTools = tools.filter(col.filter);
  const availableCategories = TOOL_CATEGORIES.filter((c) => colTools.some((t) => t.category === c));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools' },
            { name: col.name, path: `/tools/collection/${col.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: col.title,
            description: col.description,
            url: absoluteUrl(`/tools/collection/${col.slug}`),
            mainEntity: {
              '@type': 'ItemList',
              name: col.name,
              numberOfItems: colTools.length,
              itemListElement: colTools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          ...(col.faqs.length > 0 ? [faqLd(col.faqs)] : []),
        ]}
      />
      <Breadcrumb
        items={[{ name: 'Home', href: '/' }, { name: 'Tools', href: '/tools' }, { name: col.name }]}
        style={{ paddingTop: 18 }}
      />
      <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="sf" style={{ fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1, letterSpacing: '-.025em', margin: 0 }}>
            {col.name}
          </h1>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {colTools.length} {colTools.length === 1 ? 'app' : 'apps'}
          </span>
        </div>
        <Link href="/tools" className="btn gh" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
          All apps
          <Icon name="arrow" size={14} />
        </Link>
      </header>

      <section aria-label={col.name} style={{ paddingBottom: 56 }}>
        <ToolsDirectory
          key={slug}
          tools={colTools}
          categories={availableCategories}
          initialSort={slug === 'new' ? 'new' : 'votes'}
        />
      </section>

      <section aria-labelledby="col-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 36, padding: '44px 0 84px', borderTop: '1px solid var(--vg-line)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="lbl">§ About this collection</div>
          <h2 id="col-explore" className="sf" style={{ fontSize: 'clamp(28px,3vw,38px)', lineHeight: 1.04, margin: '8px 0 12px', letterSpacing: '-.02em' }}>
            {col.heading} <em className="hi">{col.accent}</em>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--vg-ink2)', margin: '0 0 18px', maxWidth: 460 }}>{col.intro}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(TOOL_COLLECTIONS) as ToolCollectionSlug[]).map((key) => (
              <Link key={key} href={`/tools/collection/${key}`} className="tag">
                {TOOL_COLLECTIONS[key].name}
              </Link>
            ))}
            {TOOL_CATEGORIES.map((c) => (
              <Link key={c} href={`/tools/category/${c.toLowerCase()}`} className="tag">
                {c} tools
              </Link>
            ))}
          </div>
        </div>
        <div style={{ flex: '2 1 560px', minWidth: 0 }}>
          {col.faqs.map((f) => (
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
