import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { NEWS_CATEGORIES } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead } from '@/components/news/news-feed';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';
import { NEWS_CATEGORY_SEO, parseNewsCategorySlug } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return NEWS_CATEGORIES.map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: PageProps<'/news/category/[category]'>): Promise<Metadata> {
  const { category: raw } = await params;
  const cat = parseNewsCategorySlug(raw);
  if (!cat) return { title: 'Section not found', robots: { index: false } };
  const seo = NEWS_CATEGORY_SEO[cat];
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: newsCategoryPath(cat),
  });
}

export default async function NewsCategoryPage({
  params,
}: PageProps<'/news/category/[category]'>) {
  const { category: raw } = await params;
  const cat = parseNewsCategorySlug(raw);
  if (!cat) notFound();
  if (raw !== cat.toLowerCase()) permanentRedirect(newsCategoryPath(cat));

  return (
    <>
      <SiteHeader active="news" />
      <main id="main">
        <NewsMasthead category={cat} />
        <NewsContent category={cat} page={1} />
      </main>
    </>
  );
}
