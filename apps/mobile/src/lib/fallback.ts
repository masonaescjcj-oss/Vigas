import type {
  Article,
  HomeFeed,
  LeaderboardCategory,
  LeaderboardResponse,
  ModelListItem,
  NewsListItem,
  ToolItem,
} from '@vigas/core';
import { SEED_TOTAL_SESSIONS, seedArticles, seedLeaderboard, seedModels, seedTools } from '@vigas/core/seed';

/**
 * Offline/demo data from `@vigas/core/seed`, shaped exactly like the `/api/app/*` responses.
 * Screens fall back to these when the server is unreachable or not configured.
 */

let articles: Article[] | null = null;
function allArticles(): Article[] {
  // Timestamps are relative to first use, so "12 min ago" stays stable while the app is open.
  articles ??= seedArticles();
  return articles;
}

const toListItem = ({ body: _b, faq: _f, mentionedModelIds: _m, pullQuote: _p, updatedAt: _u, ...item }: Article): NewsListItem =>
  item;

const toModel = ({ auto: _a, description: _d, ...m }: (typeof seedModels)[number]): ModelListItem => m;

const byVotes = (a: ToolItem, b: ToolItem) => b.votes - a.votes;

export function fallbackHome(): HomeFeed {
  return {
    news: allArticles().slice(0, 8).map(toListItem),
    topAgents: seedLeaderboard('overall').slice(0, 5),
    trendingTools: [...seedTools].sort(byVotes).slice(0, 6),
    prices: seedModels.map(toModel),
  };
}

export function fallbackNews(): { items: NewsListItem[]; total: number } {
  const items = allArticles().map(toListItem);
  return { items, total: items.length };
}

export function fallbackArticle(slug: string): Article | null {
  return allArticles().find((a) => a.slug === slug) ?? null;
}

export function fallbackTools(): { items: ToolItem[] } {
  return { items: [...seedTools].sort(byVotes) };
}

export function fallbackLeaderboard(category: LeaderboardCategory): LeaderboardResponse {
  return {
    category,
    updatedAt: new Date().toISOString(),
    totalSessions: SEED_TOTAL_SESSIONS,
    entries: seedLeaderboard(category),
  };
}

export function fallbackModels(): { items: ModelListItem[] } {
  return { items: seedModels.map(toModel) };
}
