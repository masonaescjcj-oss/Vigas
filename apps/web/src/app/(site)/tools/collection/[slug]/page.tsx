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
        style={{ paddingTop: 28 }}
      />
      <header style={{ padding: '22px 0 32px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div className="lbl">
            § Collection · {colTools.length} {colTools.length === 1 ? 'tool' : 'tools'}
          </div>
          <h1 className="sf" style={{ fontSize: 'clamp(42px,5.6vw,78px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '14px 0 14px' }}>
            {col.heading} <em className="hi">{col.accent}</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--vg-ink2)', maxWidth: 640, margin: 0 }}>{col.intro}</p>
        </div>
        <Link href="/tools" className="btn gh">
          All tools
          <Icon name="arrow" size={15} />
        </Link>
      </header>

      <section aria-label={col.name} style={{ paddingBottom: 64 }}>
        <ToolsDirectory
          key={slug}
          tools={colTools}
          categories={availableCategories}
          initialSort={slug === 'new' ? 'new' : 'votes'}
        />
      </section>

      <section aria-labelledby="col-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: '48px 0 88px', borderTop: '1px solid var(--vg-line)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="lbl">§ Collections &amp; categories</div>
          <h2 id="col-explore" className="sf" style={{ fontSize: 'clamp(30px,3.2vw,42px)', lineHeight: 1.04, margin: '10px 0 16px', letterSpacing: '-.02em' }}>
            More curated <em className="hi">shortlists.</em>
          </h2>
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
