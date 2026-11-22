import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

function parsePage(sp: Record<string, string | string[] | undefined>): number {
  const p = typeof sp.page === 'string' ? Number.parseInt(sp.page, 10) : 1;
  return Number.isFinite(p) && p >= 1 && p <= 1000 ? p : 1;
}

export async function generateMetadata({ searchParams }: PageProps<'/news/fa'>): Promise<Metadata> {
  const page = parsePage(await searchParams);
  return pageMetadata({
    title: page > 1 ? `اخبار هوش مصنوعی ویگاس · صفحه ${page}` : 'اخبار هوش مصنوعی — مدل‌ها، ایجنت‌ها و بازار AI',
    description:
      'تازه‌ترین اخبار و تحلیل‌های فارسی هوش مصنوعی در ویگاس: رونمایی مدل‌ها، تغییر تعرفه API، رده‌بندی مدل‌ها، سخت‌افزار و سیاست‌گذاری.',
    path: page > 1 ? `/news/fa?page=${page}` : '/news/fa',
    locale: 'fa_IR',
    alternatesLanguages: { en: '/news', fa: '/news/fa', 'x-default': '/news' },
    noindex: page > 1,
  });
}

export default function PersianNewsPage({ searchParams }: PageProps<'/news/fa'>) {
  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader active="news" lang="fa" altHref="/news" />
      <main id="main">
        <NewsMasthead lang="fa" />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <PersianNewsBody searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter lang="fa" altHref="/news" />
    </div>
  );
}

async function PersianNewsBody({ searchParams }: Pick<PageProps<'/news/fa'>, 'searchParams'>) {
  const page = parsePage(await searchParams);
  return <NewsContent category={null} page={page} lang="fa" />;
}
