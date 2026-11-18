import { Suspense } from 'react';
import { LiveSessions, LiveSessionsFallback } from '@/components/leaderboard/live-sessions';
import { LeaderboardView } from '@/components/leaderboard/view';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI Leaderboard — Best Models Ranked Live',
  description:
    'Live rankings of top AI models and coding agents built from real sessions and blind Arena votes — win share, Bradley-Terry scores & cost per task.',
  path: '/leaderboard',
  image: '/og/leaderboard/overall',
  imageAlt: 'Vigas AI Leaderboard — Best models and agents ranked by real use',
});

export default function LeaderboardPage() {
  return (
    <>
      <SiteHeader active="leaderboard" lang="en" />
      <main id="main" className="wrap">
        <LeaderboardView
          category="overall"
          lang="en"
          live={
            <Suspense fallback={<LiveSessionsFallback />}>
              <LiveSessions lang="en" />
            </Suspense>
          }
        />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
