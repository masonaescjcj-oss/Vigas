import type { NextRequest } from 'next/server';
import { NEWS_CATEGORIES, type NewsCategory } from '@vigas/core';
import { getNews } from '@/lib/data';
import { apiError, publicJson } from '@/lib/http';

const toInt = (v: string | null, fallback: number) => {
  if (v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.NaN;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get('category') || null;
  if (category && !NEWS_CATEGORIES.includes(category as NewsCategory)) {
    return apiError(400, 'invalid_request', `category must be one of: ${NEWS_CATEGORIES.join(', ')}.`);
  }
  const limit = toInt(sp.get('limit'), 20);
  const offset = toInt(sp.get('offset'), 0);
  if (!(limit >= 1 && limit <= 50)) return apiError(400, 'invalid_request', 'limit must be an integer from 1 to 50.');
  if (!(offset >= 0 && offset <= 100_000)) return apiError(400, 'invalid_request', 'offset must be a non-negative integer.');
  return publicJson(await getNews({ category: category as NewsCategory | null, limit, offset }));
}
