import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { TOOL_CATEGORIES } from '@vigas/core';
import { ToolCategoryPageView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';
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
  return <ToolCategoryPageView category={cat} lang="en" />;
}
