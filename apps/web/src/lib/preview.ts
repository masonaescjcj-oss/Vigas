/**
 * Preview mode: when DATABASE_URL is not set (e.g. a first Vercel deploy without a database), public
 * pages are served from the built-in sample data and everything that needs an account is disabled.
 * Set DATABASE_URL to turn the real site on; nothing else changes.
 */
import type {
  Article,
  LeaderboardCategory,
  LeaderboardResponse,
  ModelListItem,
  NewsCategory,
  NewsListItem,
  ToolCategory,
  ToolItem,
} from '@vigas/core';
import { SEED_TOTAL_SESSIONS, seedArticles, seedLeaderboard, seedModels, seedTools } from '@vigas/core/seed';

export const PREVIEW_MODE = !process.env.DATABASE_URL;

export const PREVIEW_MESSAGE = 'This is a preview without a database, so accounts, chat and payments are turned off.';

export function previewModels(): ModelListItem[] {
  return seedModels
    .map((m) => ({
      id: m.id,
      name: m.name,
      org: m.org,
      contextLength: m.contextLength,
      inputPerMillionMicros: m.inputPerMillionMicros,
      outputPerMillionMicros: m.outputPerMillionMicros,
      tags: m.tags,
      priceChange24h: m.priceChange24h,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function previewNews(opts: { category?: NewsCategory | null; limit?: number; offset?: number }): { items: NewsListItem[]; total: number } {
  const all = seedArticles().filter((a) => !opts.category || a.category === opts.category);
  const offset = opts.offset ?? 0;
  const items = all.slice(offset, offset + (opts.limit ?? 20)).map(
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
  return { items, total: all.length };
}

export function previewArticle(slug: string): Article | null {
  return seedArticles().find((a) => a.slug === slug) ?? null;
}

export function previewTools(opts: { category?: ToolCategory | null; q?: string | null; sort?: 'votes' | 'rating' | 'new' }): ToolItem[] {
  const q = opts.q?.trim().toLowerCase();
  const list = seedTools
    .filter((t) => !opts.category || t.category === opts.category)
    .filter((t) => !q || `${t.name} ${t.tagline} ${t.category}`.toLowerCase().includes(q))
    .map((t) => ({ ...t, voted: false }));
  if (opts.sort === 'rating') return list.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  if (opts.sort === 'new') return list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return list.sort((a, b) => b.votes - a.votes);
}

export function previewLeaderboard(category: LeaderboardCategory): LeaderboardResponse {
  return { category, updatedAt: new Date().toISOString(), totalSessions: SEED_TOTAL_SESSIONS, entries: seedLeaderboard(category) };
}

export function previewSitemap(): { articles: Array<{ slug: string; updatedAt: string }>; tools: Array<{ slug: string }> } {
  return {
    articles: seedArticles().map((a) => ({ slug: a.slug, updatedAt: a.updatedAt })),
    tools: seedTools.map((t) => ({ slug: t.slug })),
  };
}
