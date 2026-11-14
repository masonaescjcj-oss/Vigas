import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import type { NewsCategory } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
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
  const { category, page, lang } = parse(await searchParams);
  const base = category
    ? `${category} AI news`
    : lang === 'fa'
      ? 'اخبار هوش مصنوعی ویگاس — فارسی'
      : 'AI News — models, agents, policy and funding';
  return pageMetadata({
    title: page > 1 ? `${base} · page ${page}` : base,
    description: category
      ? `The latest ${category.toLowerCase()} stories in AI from the Vigas Newsroom: launches, prices, rankings and analysis.`
      : 'AI news from the Vigas Newsroom: model launches, agents, inference prices, policy, hardware and funding — in English and Persian with live leaderboard data.',
    path: newsCategoryPath(category, page, lang),
    locale: lang === 'fa' ? 'fa_IR' : 'en_US',
    noindex: Boolean(category || lang || page > 1),
  });
}

export default function NewsPage({ searchParams }: PageProps<'/news'>) {
  return (
    <>
      <SiteHeader active="news" />
      <main id="main">
        <NewsMasthead />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <NewsBody searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function NewsBody({ searchParams }: Pick<PageProps<'/news'>, 'searchParams'>) {
  const { category, page, lang } = parse(await searchParams);
  if (category) permanentRedirect(newsCategoryPath(category, page, lang));
  return <NewsContent category={null} page={page} lang={lang} />;
}
