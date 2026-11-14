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
  return NEWS_CATEGORIES.map((c) => ({ category: c.toLowerCase(), page: '2' }));
}

function parsePageParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : null;
}

export async function generateMetadata({
  params,
}: PageProps<'/news/category/[category]/page/[page]'>): Promise<Metadata> {
  const { category: rawCat, page: rawPage } = await params;
  const cat = parseNewsCategorySlug(rawCat);
  const page = parsePageParam(rawPage);
  if (!cat || !page || page < 2) return { title: 'Section page not found', robots: { index: false } };
  const seo = NEWS_CATEGORY_SEO[cat];
  return pageMetadata({
    title: `${seo.title} · page ${page}`,
    description: seo.description,
    path: newsCategoryPath(cat, page),
    noindex: true,
  });
}

export default async function NewsCategoryPaginatedPage({
  params,
}: PageProps<'/news/category/[category]/page/[page]'>) {
  const { category: rawCat, page: rawPage } = await params;
  const cat = parseNewsCategorySlug(rawCat);
  const page = parsePageParam(rawPage);
  if (!cat || !page) notFound();
  if (page === 1 || rawCat !== cat.toLowerCase()) permanentRedirect(newsCategoryPath(cat, page));

  return (
    <>
      <SiteHeader active="news" lang="en" altHref={newsCategoryPath(cat, 1, 'fa')} />
      <main id="main">
        <NewsMasthead category={cat} lang="en" />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <NewsContent category={cat} page={page} lang="en" />
        </Suspense>
      </main>
    </>
  );
}
