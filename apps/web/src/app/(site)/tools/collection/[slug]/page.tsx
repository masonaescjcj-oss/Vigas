import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ToolCollectionPageView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';
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
  return <ToolCollectionPageView slug={slug} lang="en" />;
}
