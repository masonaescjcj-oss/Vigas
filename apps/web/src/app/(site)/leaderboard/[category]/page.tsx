import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { LiveSessions, LiveSessionsFallback } from '@/components/leaderboard/live-sessions';
import { categoryLabel, LeaderboardView } from '@/components/leaderboard/view';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

const isCategory = (v: string): v is LeaderboardCategory => LEADERBOARD_CATEGORIES.some((c) => c.id === v);

const DESCRIPTIONS: Record<LeaderboardCategory, string> = {
  overall: '',
  coding: 'The best AI models for coding, ranked by real coding sessions and blind votes on Vigas — win share, scores and cost per task.',
  webdev: 'The best AI models for building websites and web apps, ranked by real WebDev sessions and blind votes on Vigas.',
  text: 'The best AI models for writing and text tasks, ranked by real sessions and blind pairwise votes on Vigas.',
  vision: 'The best multimodal AI models for vision and image understanding, ranked by real use on Vigas.',
  'image-edit': 'The best AI models for image editing, ranked by real sessions and blind votes on Vigas.',
  aligned: 'AI models ranked on aligned, safe and helpful behaviour in real sessions and blind votes on Vigas.',
  work: 'The best AI models for everyday knowledge work, ranked by real sessions and blind votes on Vigas.',
};

export function generateStaticParams() {
  return LEADERBOARD_CATEGORIES.filter((c) => c.id !== 'overall').map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: PageProps<'/leaderboard/[category]'>): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category) || category === 'overall') return {};
  const label = categoryLabel(category);
  return pageMetadata({
    title: `Best ${label} AI models — ${label} leaderboard`,
    description: DESCRIPTIONS[category],
    path: `/leaderboard/${category}`,
  });
}

export default async function CategoryLeaderboardPage({ params }: PageProps<'/leaderboard/[category]'>) {
  const { category } = await params;
  if (category === 'overall') permanentRedirect('/leaderboard');
  if (!isCategory(category)) notFound();
  return (
    <>
      <SiteHeader active="leaderboard" />
      <main id="main" className="wrap">
        <LeaderboardView
          category={category}
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
