/**
 * Cached reads of public content. Every function here is shared by all visitors, so none of them may
 * take user-specific input. User-specific data (wallet, keys, votes) is read uncached in route
 * handlers and request-time components.
 */
import { cacheLife, cacheTag } from 'next/cache';
import type {
  Article,
  HomeFeed,
  LeaderboardCategory,
  LeaderboardResponse,
  ModelListItem,
  NewsCategory,
  NewsListItem,
  ToolCategory,
  ToolItem,
} from '@vigas/core';
import {
  countArticles,
  getArticle,
  getDb,
  getLeaderboard,
  listArticleSitemap,
  listArticles,
  listModels,
  listRecentSessions,
  listToolSitemap,
  listTools,
  type RecentSession,
  type ToolSort,
} from '@vigas/db';
import { loadLocalArticles } from './local-articles';
import {
  PREVIEW_MODE,
  previewArticle,
  previewLeaderboard,
  previewModels,
  previewNews,
  previewSitemap,
  previewTools,
} from './preview';

export async function getModels(): Promise<ModelListItem[]> {
  'use cache';
  cacheLife('content');
  cacheTag('models');
  if (PREVIEW_MODE) return previewModels();
  const rows = await listModels(getDb());
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    org: m.org,
    contextLength: m.contextLength,
    inputPerMillionMicros: m.inputPerMillionMicros,
    outputPerMillionMicros: m.outputPerMillionMicros,
    tags: m.tags,
    priceChange24h: m.priceChange24h,
  }));
}

export async function getNews(
  opts: { category?: NewsCategory | null; limit?: number; offset?: number } = {},
): Promise<{ items: NewsListItem[]; total: number }> {
  'use cache';
  cacheLife('content');
  cacheTag('news');
  if (PREVIEW_MODE) return previewNews(opts);
  const db = getDb();
  const category = opts.category ?? null;
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const local = loadLocalArticles()
    .filter((a) => !category || a.category === category)
    .map(
      (a): NewsListItem => ({
        slug: a.slug,
        title: a.title,
        dek: a.dek,
        category: a.category,
        flag: a.flag,
        author: a.author,
        publishedAt: a.publishedAt,
        readingMinutes: a.readingMinutes,
        cover: a.cover,
      }),
    );
  if (local.length === 0) {
    const [items, total] = await Promise.all([listArticles(db, { category, limit, offset }), countArticles(db, category)]);
    return { items, total };
  }
  const [dbItems, dbTotal] = await Promise.all([
    listArticles(db, { category, limit: 100, offset: 0 }),
    countArticles(db, category),
  ]);
  const dbSlugs = new Set(dbItems.map((a) => a.slug));
  const extraLocal = local.filter((a) => !dbSlugs.has(a.slug));
  const merged = [...dbItems, ...extraLocal].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items: merged.slice(offset, offset + limit), total: dbTotal + extraLocal.length };
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  'use cache';
  cacheLife('content');
  cacheTag('news', `article:${slug}`);
  if (PREVIEW_MODE) return previewArticle(slug);
  const fromDb = await getArticle(getDb(), slug);
  if (fromDb) return fromDb;
  return loadLocalArticles().find((a) => a.slug === slug) ?? null;
}

export async function getTools(
  opts: { category?: ToolCategory | null; q?: string | null; sort?: ToolSort } = {},
): Promise<ToolItem[]> {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');
  if (PREVIEW_MODE) return previewTools(opts);
  const items = await listTools(getDb(), { category: opts.category ?? null, q: opts.q ?? null, sort: opts.sort ?? 'votes' });
  return items.map((t) => ({ ...t, voted: false }));
}

export async function getToolBySlug(slug: string): Promise<ToolItem | null> {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools', `tool:${slug}`);
  if (PREVIEW_MODE) return previewTools({}).find((t) => t.slug === slug) ?? null;
  const all = await listTools(getDb(), { limit: 200 });
  const tool = all.find((t) => t.slug === slug);
  return tool ? { ...tool, voted: false } : null;
}

export async function getLeaderboardData(category: LeaderboardCategory): Promise<LeaderboardResponse> {
  'use cache';
  cacheLife('content');
  cacheTag('leaderboard', `leaderboard:${category}`);
  if (PREVIEW_MODE) return previewLeaderboard(category);
  return getLeaderboard(getDb(), category);
}

export async function getRecentSessions(): Promise<RecentSession[]> {
  'use cache';
  // Short-lived so the block feels live, but long enough (expire >= 5 min) to stay in static output.
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  cacheTag('sessions');
  if (PREVIEW_MODE) return [];
  return listRecentSessions(getDb(), { limit: 6 });
}

/**
 * Up to six prices for the home page: the biggest 24h price drops first, then the best-ranked models,
 * shown in leaderboard order.
 */
function featuredPrices(models: ModelListItem[], board: LeaderboardResponse): ModelListItem[] {
  const rank = new Map(board.entries.map((e) => [e.modelId, e.rank]));
  const drops = models.filter((m) => m.priceChange24h < 0).sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 3);
  const picked = new Map(drops.map((m) => [m.id, m]));
  for (const e of board.entries) {
    if (picked.size >= 6) break;
    const m = models.find((x) => x.id === e.modelId);
    if (m) picked.set(m.id, m);
  }
  for (const m of models) {
    if (picked.size >= 6) break;
    picked.set(m.id, m);
  }
  return [...picked.values()].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

export async function getHomeFeed(): Promise<HomeFeed> {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'leaderboard', 'tools', 'models');
  const [news, board, tools, models] = await Promise.all([
    getNews({ limit: 6 }),
    getLeaderboardData('overall'),
    getTools({ sort: 'votes' }),
    getModels(),
  ]);
  return {
    news: news.items,
    topAgents: board.entries.slice(0, 8),
    trendingTools: tools.slice(0, 6),
    prices: featuredPrices(models, board),
  };
}

export async function getSitemapData(): Promise<{
  articles: Array<{ slug: string; updatedAt: string }>;
  tools: Array<{ slug: string }>;
}> {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'tools');
  if (PREVIEW_MODE) return previewSitemap();
  const db = getDb();
  const [dbArticles, tools] = await Promise.all([listArticleSitemap(db), listToolSitemap(db)]);
  const bySlug = new Map<string, string>();
  for (const a of loadLocalArticles()) bySlug.set(a.slug, a.updatedAt);
  for (const a of dbArticles) bySlug.set(a.slug, a.updatedAt.toISOString());
  const articles = [...bySlug.entries()]
    .map(([slug, updatedAt]) => ({ slug, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { articles, tools };
}
