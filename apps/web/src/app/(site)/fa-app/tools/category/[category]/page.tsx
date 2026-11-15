import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { TOOL_CATEGORIES } from '@vigas/core';
import { ToolCategoryPageView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';
import { parseToolCategorySlug, TOOL_CATEGORY_SEO_FA } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return TOOL_CATEGORIES.map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: raw } = await params;
  const cat = parseToolCategorySlug(raw);
  if (!cat) return { title: 'دسته یافت نشد', robots: { index: false, follow: false } };
  const seo = TOOL_CATEGORY_SEO_FA[cat];
  return {
    ...pageMetadata({
      title: seo.title,
      description: seo.description,
      path: `/tools/category/${seo.slug}`,
      locale: 'fa_IR',
    }),
    robots: { index: false, follow: false },
  };
}

export default async function FaToolsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: raw } = await params;
  const cat = parseToolCategorySlug(raw);
  if (!cat) notFound();
  if (raw !== cat.toLowerCase()) permanentRedirect(`/tools/category/${cat.toLowerCase()}`);
  return <ToolCategoryPageView category={cat} lang="fa" />;
}
