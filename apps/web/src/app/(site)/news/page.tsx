import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import type { NewsCategory } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';
import { parseNewsCategorySlug } from '@/lib/seo-catalog';

function parseLang(raw: unknown): 'en' | 'fa' | null {
  return raw === 'en' || raw === 'fa' ? raw : null;
}

function parse(sp: Record<string, string | string[] | undefined>): { category: NewsCategory | null; page: number; lang: 'en' | 'fa' | null } {
  const c = typeof sp.category === 'string' ? sp.category : null;
  const category = c ? parseNewsCategorySlug(c) : null;
  const lang = parseLang(sp.lang);
  const p = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : 1;
  return { category, page: Number.isFinite(p) && p >= 1 && p <= 1000 ? p : 1, lang };
}

export async function generateMetadata({ searchParams }: PageProps<'/news'>): Promise<Metadata> {
  const { category, page } = parse(await searchParams);
  const base = category ? `${category} AI news` : 'AI News — models, agents, policy and funding';
  return pageMetadata({
    title: page > 1 ? `${base} · page ${page}` : base,
    description: category
      ? `The latest ${category.toLowerCase()} stories in AI from the Vigas Newsroom: launches, prices, rankings and analysis.`
      : 'AI news from the Vigas Newsroom: model launches, agents, inference prices, policy, hardware and funding — backed by live leaderboard data.',
    path: newsCategoryPath(category, page, 'en'),
    locale: 'en_US',
    alternatesLanguages: category
      ? { en: newsCategoryPath(category, 1, 'en'), fa: newsCategoryPath(category, 1, 'fa'), 'x-default': newsCategoryPath(category, 1, 'en') }
      : { en: '/news', fa: '/news/fa', 'x-default': '/news' },
    noindex: Boolean(category || page > 1),
  });
}

export default function NewsPage({ searchParams }: PageProps<'/news'>) {
  return (
    <>
      <SiteHeader active="news" lang="en" />
      <main id="main">
        <NewsMasthead lang="en" />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <NewsBody searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter lang="en" altHref="/news/fa" />
    </>
  );
}

async function NewsBody({ searchParams }: Pick<PageProps<'/news'>, 'searchParams'>) {
  const { category, page, lang } = parse(await searchParams);
  if (lang === 'fa') permanentRedirect(newsCategoryPath(category, page, 'fa'));
  if (lang === 'en' || category) permanentRedirect(newsCategoryPath(category, page, 'en'));
  return <NewsContent category={null} page={page} lang="en" />;
}
