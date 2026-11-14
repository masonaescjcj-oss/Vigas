import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { NEWS_CATEGORIES } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
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
  const enPath = newsCategoryPath(cat, 1, 'en');
  const faPath = newsCategoryPath(cat, 1, 'fa');
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: enPath,
    locale: 'en_US',
    alternatesLanguages: { en: enPath, fa: faPath, 'x-default': enPath },
  });
}

export default async function NewsCategoryPage({
  params,
}: PageProps<'/news/category/[category]'>) {
  const { category: raw } = await params;
  const cat = parseNewsCategorySlug(raw);
  if (!cat) notFound();
  if (raw !== cat.toLowerCase()) permanentRedirect(newsCategoryPath(cat, 1, 'en'));

  return (
    <>
      <SiteHeader active="news" lang="en" altHref={newsCategoryPath(cat, 1, 'fa')} />
      <main id="main">
        <NewsMasthead category={cat} lang="en" />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <NewsContent category={cat} page={1} lang="en" />
        </Suspense>
      </main>
    </>
  );
}
