import type { MetadataRoute } from 'next';
import { LEADERBOARD_CATEGORIES, NEWS_CATEGORIES } from '@vigas/core';
import { getSitemapData } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { articles, tools } = await getSitemapData();
  const newest = articles[0]?.updatedAt;
  const entry = (path: string, changeFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly', priority: number, lastModified?: string) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    entry('/', 'hourly', 1, newest),
    entry('/models', 'daily', 0.9),
    entry('/leaderboard', 'hourly', 0.9),
    ...LEADERBOARD_CATEGORIES.filter((c) => c.id !== 'overall').map((c) => entry(`/leaderboard/${c.id}`, 'daily', 0.8)),
    entry('/news', 'hourly', 0.9, newest),
    ...NEWS_CATEGORIES.map((c) => entry(`/news?category=${c}`, 'daily', 0.6)),
    ...articles.map((a) => entry(`/news/${a.slug}`, 'weekly', 0.7, a.updatedAt)),
    entry('/tools', 'daily', 0.8),
    ...tools.map((t) => entry(`/tools/${t.slug}`, 'weekly', 0.6)),
    entry('/retrobuild', 'monthly', 0.6),
    entry('/signup', 'monthly', 0.3),
  ];
}
