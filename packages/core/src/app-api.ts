/**
 * Contract for the app API served by apps/web under `/api/app/*` and consumed by the Android app
 * (and by client components on the website). All money values are integer micro-dollars.
 */

import type { ModelTag } from './models';

export type NewsCategory = 'Models' | 'Agents' | 'Analysis' | 'Policy' | 'Hardware' | 'Funding' | 'Tools';
export const NEWS_CATEGORIES: readonly NewsCategory[] = ['Models', 'Agents', 'Analysis', 'Policy', 'Hardware', 'Funding', 'Tools'];

export type ToolCategory = 'Agents' | 'Coding' | 'Research' | 'Image' | 'Video' | 'Audio' | 'Productivity';
export const TOOL_CATEGORIES: readonly ToolCategory[] = ['Agents', 'Coding', 'Research', 'Image', 'Video', 'Audio', 'Productivity'];

export type LeaderboardCategory = 'overall' | 'coding' | 'webdev' | 'text' | 'vision' | 'image-edit' | 'aligned' | 'work';
export const LEADERBOARD_CATEGORIES: ReadonlyArray<{ id: LeaderboardCategory; label: string }> = [
  { id: 'overall', label: 'Overall' },
  { id: 'coding', label: 'Coding' },
  { id: 'webdev', label: 'WebDev' },
  { id: 'text', label: 'Text' },
  { id: 'vision', label: 'Vision' },
  { id: 'image-edit', label: 'Image edit' },
  { id: 'aligned', label: 'Aligned' },
  { id: 'work', label: 'Work' },
];

/** Typographic cover used instead of photos: a big figure and a small caption. */
export interface Cover {
  big: string;
  caption: string;
  color: string;
}

export interface Author {
  slug: string;
  name: string;
  role: string;
  color: string;
}

export interface NewsListItem {
  slug: string;
  title: string;
  dek: string;
  category: NewsCategory;
  flag: 'Breaking' | 'Analysis' | 'Exclusive' | null;
  author: Author;
  publishedAt: string;
  readingMinutes: number;
  cover: Cover;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Article extends NewsListItem {
  updatedAt: string;
  /** Markdown. */
  body: string;
  faq: FaqItem[];
  mentionedModelIds: string[];
  pullQuote: { text: string; cite: string } | null;
}

export interface ToolItem {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  pricing: 'Free' | 'Freemium' | 'Paid';
  rating: number;
  votes: number;
  color: string;
  letter: string;
  url: string;
  runsOnVigas: boolean;
  isNew: boolean;
  /** True when the signed-in user upvoted it. */
  voted?: boolean;
}

export interface ModelListItem {
  id: string;
  name: string;
  org: string;
  contextLength: number;
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
  tags: ModelTag[];
  priceChange24h: number;
}

export interface LeaderboardEntry {
  rank: number;
  modelId: string;
  name: string;
  org: string;
  /** Percent of sessions won. */
  winRate: number;
  rating: number;
  ci: number;
  costPerTaskMicros: number;
  votes: number;
  /** Last 8 daily win rates, oldest first. */
  trend: number[];
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  updatedAt: string;
  totalSessions: number;
  entries: LeaderboardEntry[];
}

export interface HomeFeed {
  news: NewsListItem[];
  topAgents: LeaderboardEntry[];
  trendingTools: ToolItem[];
  prices: ModelListItem[];
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  user: PublicUser;
  /** Bearer token for the Android app; the website uses an httpOnly cookie instead. */
  token: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  /** e.g. "sk-vg-v1-98a4••••3f12" */
  display: string;
  createdAt: string;
  lastUsedAt: string | null;
  spentThisMonthMicros: number;
  /** Monthly spending cap for this key; null or absent = no cap. */
  monthlyLimitMicros?: number | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  /** Shown once, never stored in plain text. */
  key: string;
}

export interface UsageDay {
  date: string;
  costMicros: number;
}

export interface WalletResponse {
  balanceMicros: number;
  lifetimeTopupMicros: number;
  feeBps: number;
  week: UsageDay[];
  bySource: Array<{ source: 'api' | 'chat' | 'arena' | 'retrobuild'; costMicros: number }>;
  keys: ApiKeySummary[];
}

export interface TopupResponse {
  balanceMicros: number;
  chargedMicros: number;
  feeMicros: number;
}

export interface ArenaSide {
  label: 'A' | 'B';
  content: string;
  /** Revealed only after the vote. */
  modelId?: string;
  modelName?: string;
}

export interface ArenaBattleResponse {
  battleId: string;
  prompt: string;
  sides: [ArenaSide, ArenaSide];
}

export type ArenaVote = 'a' | 'b' | 'tie' | 'bad';

export interface ArenaVoteResponse {
  battleId: string;
  vote: ArenaVote;
  sides: [Required<ArenaSide>, Required<ArenaSide>];
}

export interface AppError {
  error: { code: string; message: string };
}
