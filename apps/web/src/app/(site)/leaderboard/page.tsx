import { Suspense } from 'react';
import { LiveSessions, LiveSessionsFallback } from '@/components/leaderboard/live-sessions';
import { LeaderboardView } from '@/components/leaderboard/view';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI Leaderboard — best AI models and agents ranked by real use',
  description:
    'Live rankings of the best AI models and agents, built from real sessions and blind Arena votes on Vigas — with win share, Bradley–Terry scores, confidence intervals and cost per task.',
  path: '/leaderboard',
});

export default function LeaderboardPage() {
  return (
    <>
      <SiteHeader active="leaderboard" />
      <main id="main" className="wrap">
        <LeaderboardView
          category="overall"
          live={
            <Suspense fallback={<LiveSessionsFallback />}>
              <LiveSessions />
            </Suspense>
          }
        />
      </main>
    </>
  );
}
