import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { LiveSessions, LiveSessionsFallback } from '@/components/leaderboard/live-sessions';
import { categoryLabel, LeaderboardView } from '@/components/leaderboard/view';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

const isCategory = (v: string): v is LeaderboardCategory => LEADERBOARD_CATEGORIES.some((c) => c.id === v);

const DESCRIPTIONS_FA: Record<LeaderboardCategory, string> = {
  overall: '',
  coding: 'بهترین مدل‌های هوش مصنوعی برای کدنویسی، رتبه‌بندی‌شده با نشست‌های واقعی برنامه‌نویسی و آرای کور Arena در ویگاس — سهم برد، امتیاز و هزینه هر کار.',
  webdev: 'بهترین مدل‌های هوش مصنوعی برای ساخت وب‌سایت و اپلیکیشن وب بر اساس آزمون واقعی WebDev و رأی کور کاربران در ویگاس.',
  text: 'بهترین مدل‌های هوش مصنوعی برای نگارش، استدلال و پردازش متن بر پایه نشست‌های واقعی و مقایسه‌های جفتی در ویگاس.',
  vision: 'بهترین مدل‌های چندرسانه‌ای هوش مصنوعی برای بینایی و درک تصویر و نمودار در ویگاس.',
  'image-edit': 'بهترین مدل‌های هوش مصنوعی برای ویرایش تصویر، حفظ سبک و دقت فضایی در نشست‌های واقعی ویگاس.',
  aligned: 'رده‌بندی مدل‌های هوش مصنوعی از نظر رفتار ایمن، دقیق و هم‌راستا در نشست‌های واقعی و آرای کور ویگاس.',
  work: 'بهترین مدل‌های هوش مصنوعی برای کارهای تخصصی و دانش‌بنیان روزمره در ویگاس.',
};

export const ensureStatic = 'navigation';
export const instant = false;

export function generateStaticParams() {
  return LEADERBOARD_CATEGORIES.filter((c) => c.id !== 'overall').map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category) || category === 'overall') return { robots: { index: false, follow: false } };
  const label = categoryLabel(category, 'fa');
  return {
    ...pageMetadata({
      title: `بهترین مدل‌های ${label} — لیدربورد ${label}`,
      description: DESCRIPTIONS_FA[category],
      path: `/leaderboard/${category}`,
      locale: 'fa_IR',
      image: `/og/leaderboard/${category}`,
      imageAlt: `بهترین مدل‌های ${label} در لیدربورد ویگاس`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function FaCategoryLeaderboardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (category === 'overall') permanentRedirect('/leaderboard');
  if (!isCategory(category)) notFound();
  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader active="leaderboard" lang="fa" />
      <main id="main" className="wrap">
        <LeaderboardView
          category={category}
          lang="fa"
          live={
            <Suspense fallback={<LiveSessionsFallback />}>
              <LiveSessions lang="fa" />
            </Suspense>
          }
        />
      </main>
      <SiteFooter lang="fa" />
    </div>
  );
}
