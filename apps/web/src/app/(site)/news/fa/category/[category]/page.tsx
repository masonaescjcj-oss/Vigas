import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { NEWS_CATEGORIES } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { getNews } from '@/lib/data';
import { pageMetadata } from '@/lib/seo';
import { parseNewsCategorySlug } from '@/lib/seo-catalog';

const FA_CATEGORY_LABELS: Record<string, string> = {
  Models: 'مدل‌های هوش مصنوعی',
  Agents: 'ایجنت‌های هوشمند',
  Analysis: 'تحلیل‌های تخصصی AI',
  Policy: 'سیاست‌گذاری و ایمنی AI',
  Hardware: 'تراشه و سخت‌افزار AI',
  Funding: 'سرمایه‌گذاری و استارتاپ‌های AI',
  Tools: 'ابزارهای هوش مصنوعی',
};

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return NEWS_CATEGORIES.map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: PageProps<'/news/fa/category/[category]'>): Promise<Metadata> {
  const { category: raw } = await params;
  const cat = parseNewsCategorySlug(raw);
  if (!cat) return { title: 'بخش خبری یافت نشد', robots: { index: false } };
  const faLabel = FA_CATEGORY_LABELS[cat] ?? cat;
  const enPath = newsCategoryPath(cat, 1, 'en');
  const faPath = newsCategoryPath(cat, 1, 'fa');
  const [faRes, enRes] = await Promise.all([
    getNews({ category: cat, lang: 'fa', limit: 1 }),
    getNews({ category: cat, lang: 'en', limit: 1 }),
  ]);
  const hasFa = faRes.total > 0;
  const hasEn = enRes.total > 0;
  const alternatesLanguages: Record<string, string> | undefined = hasFa
    ? hasEn
      ? { en: enPath, fa: faPath, 'x-default': enPath }
      : { fa: faPath }
    : undefined;
  return pageMetadata({
    title: `اخبار ${faLabel}`,
    description: `تازه‌ترین گزارش‌ها و تحلیل‌های فارسی درباره ${faLabel} در ویگاس — همراه با رده‌بندی زنده مدل‌ها و تعرفه مستقیم API.`,
    path: faPath,
    locale: 'fa_IR',
    alternatesLanguages,
    noindex: !hasFa,
  });
}

export default async function PersianNewsCategoryPage({
  params,
}: PageProps<'/news/fa/category/[category]'>) {
  const { category: raw } = await params;
  const cat = parseNewsCategorySlug(raw);
  if (!cat) notFound();
  if (raw !== cat.toLowerCase()) permanentRedirect(newsCategoryPath(cat, 1, 'fa'));

  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader active="news" lang="fa" altHref={newsCategoryPath(cat, 1, 'en')} />
      <main id="main">
        <NewsMasthead category={cat} lang="fa" />
        <Suspense fallback={<NewsRiverSkeleton />}>
          <NewsContent category={cat} page={1} lang="fa" />
        </Suspense>
      </main>
      <SiteFooter lang="fa" altHref={newsCategoryPath(cat, 1, 'en')} />
    </div>
  );
}
