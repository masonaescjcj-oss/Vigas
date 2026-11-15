import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ToolCollectionPageView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';
import { parseToolCollectionSlug, TOOL_COLLECTIONS_FA, type ToolCollectionSlug } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return (Object.keys(TOOL_COLLECTIONS_FA) as ToolCollectionSlug[]).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = parseToolCollectionSlug(raw);
  if (!slug) return { title: 'کلکسیون یافت نشد', robots: { index: false, follow: false } };
  const col = TOOL_COLLECTIONS_FA[slug];
  return {
    ...pageMetadata({
      title: col.title,
      description: col.description,
      path: `/tools/collection/${col.slug}`,
      locale: 'fa_IR',
    }),
    robots: { index: false, follow: false },
  };
}

export default async function FaToolsCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = parseToolCollectionSlug(raw);
  if (!slug) notFound();
  if (raw !== slug) permanentRedirect(`/tools/collection/${slug}`);
  return <ToolCollectionPageView slug={slug} lang="fa" />;
}
