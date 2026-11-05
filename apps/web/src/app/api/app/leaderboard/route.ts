import type { NextRequest } from 'next/server';
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory } from '@vigas/core';
import { getLeaderboardData } from '@/lib/data';
import { apiError, publicJson } from '@/lib/http';

export async function GET(req: NextRequest) {
  const category = (req.nextUrl.searchParams.get('category') || 'overall') as LeaderboardCategory;
  if (!LEADERBOARD_CATEGORIES.some((c) => c.id === category)) {
    return apiError(400, 'invalid_request', `category must be one of: ${LEADERBOARD_CATEGORIES.map((c) => c.id).join(', ')}.`);
  }
  return publicJson(await getLeaderboardData(category));
}
