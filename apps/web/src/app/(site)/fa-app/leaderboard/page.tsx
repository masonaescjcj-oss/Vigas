import { Suspense } from 'react';
import { LiveSessions, LiveSessionsFallback } from '@/components/leaderboard/live-sessions';
import { LeaderboardView } from '@/components/leaderboard/view';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'لیدربورد هوش مصنوعی — برترین مدل‌ها و ایجنت‌ها در آزمون واقعی',
    description:
      'رتبه‌بندی زنده بهترین مدل‌ها و ایجنت‌های هوش مصنوعی بر اساس نشست‌های واقعی API و ارزیابی‌های معتبر در ویگاس — همراه با سهم برد، امتیاز برادلی-تری و هزینه هر تسک.',
    path: '/leaderboard',
    locale: 'fa_IR',
    image: '/og/leaderboard/overall',
    imageAlt: 'لیدربورد زنده هوش مصنوعی ویگاس',
  }),
  robots: { index: false, follow: false },
};

export default function FaLeaderboardPage() {
  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader active="leaderboard" lang="fa" />
      <main id="main" className="wrap">
        <LeaderboardView
          category="overall"
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
