import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { renderLeaderboardOg } from '@/lib/og';

const isCategory = (v: string): v is LeaderboardCategory => LEADERBOARD_CATEGORIES.some((c) => c.id === v);

export async function GET(_req: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategory(category)) return new Response('Category not found', { status: 404 });
  return renderLeaderboardOg(category);
}
