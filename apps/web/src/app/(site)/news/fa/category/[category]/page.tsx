import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { NEWS_CATEGORIES } from '@vigas/core';
import { newsCategoryPath, NewsContent, NewsMasthead, NewsRiverSkeleton } from '@/components/news/news-feed';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';
import { parseNewsCategorySlug } from '@/lib/seo-catalog';

const FA_CATEGORY_LABELS: Record<string, string> = {
  Models: 'مدل‌های هوش مصنوعی',
  Agents: 'ایجنت‌های هوشمند',
  Analysis: 'تحلیل‌های تخصصی AI',
  Policy: 'سیاست‌گذاری و ایمنی هوش مصنوعی',
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
  return pageMetadata({
    title: `اخبار ${faLabel} | تحریریه فارسی ویگاس`,
    description: `تازه‌ترین گزارش‌ها و تحلیل‌های فارسی درباره ${faLabel} در ویگاس — همراه با رده‌بندی زنده مدل‌ها و تعرفه‌های مستقیم API.`,
    path: faPath,
    locale: 'fa_IR',
    alternatesLanguages: { en: enPath, fa: faPath, 'x-default': enPath },
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
    </div>
  );
}
