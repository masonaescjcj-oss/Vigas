import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Cover, FaqItem } from '@vigas/core';

const micros = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ── Identity ────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

// ── Billing ─────────────────────────────────────────────────────────────────

/**
 * One billing account per user for now (teams later). `balanceMicros` is the spendable balance:
 * the sum of ledger entries minus active credit holds.
 */
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balanceMicros: micros('balance_micros').notNull().default(0),
  lifetimeTopupMicros: micros('lifetime_topup_micros').notNull().default(0),
  createdAt: createdAt(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    display: text('display').notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('api_keys_account_idx').on(t.accountId)],
);

/** Every real money movement. Positive = credit, negative = debit. */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    amountMicros: micros('amount_micros').notNull(),
    kind: text('kind', { enum: ['topup', 'usage', 'refund', 'adjustment', 'promo'] }).notNull(),
    reference: text('reference'),
    createdAt: createdAt(),
  },
  (t) => [index('ledger_account_idx').on(t.accountId, t.createdAt)],
);

/** Credits reserved while a request is in flight. Released on settle or by the cleanup job. */
export const creditHolds = pgTable(
  'credit_holds',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    amountMicros: micros('amount_micros').notNull(),
    createdAt: createdAt(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (t) => [index('holds_open_idx').on(t.createdAt).where(sql`${t.releasedAt} is null`)],
);

export const topups = pgTable('topups', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  amountMicros: micros('amount_micros').notNull(),
  feeMicros: micros('fee_micros').notNull(),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull().default('pending'),
  createdAt: createdAt(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    apiKeyId: text('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    source: text('source', { enum: ['api', 'chat', 'arena', 'retrobuild'] }).notNull(),
    modelId: text('model_id').notNull(),
    provider: text('provider').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    costMicros: micros('cost_micros').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    status: text('status', { enum: ['ok', 'error'] }).notNull(),
    errorCode: text('error_code'),
    createdAt: createdAt(),
  },
  (t) => [index('usage_account_idx').on(t.accountId, t.createdAt), index('usage_key_idx').on(t.apiKeyId, t.createdAt)],
);

// ── Catalogue ───────────────────────────────────────────────────────────────

export const models = pgTable('models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  org: text('org').notNull(),
  contextLength: integer('context_length').notNull(),
  inputPerMillionMicros: micros('input_per_million_micros').notNull(),
  outputPerMillionMicros: micros('output_per_million_micros').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  priceChange24h: real('price_change_24h').notNull().default(0),
  auto: boolean('auto').notNull().default(false),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelEndpoints = pgTable(
  'model_endpoints',
  {
    id: serial('id').primaryKey(),
    modelId: text('model_id').notNull().references(() => models.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    upstreamModel: text('upstream_model').notNull(),
    inputPerMillionMicros: micros('input_per_million_micros').notNull(),
    outputPerMillionMicros: micros('output_per_million_micros').notNull(),
    priority: integer('priority').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [uniqueIndex('endpoint_model_provider_idx').on(t.modelId, t.provider)],
);

// ── Content ─────────────────────────────────────────────────────────────────

export const authors = pgTable('authors', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  color: text('color').notNull(),
});

export const articles = pgTable(
  'articles',
  {
    slug: text('slug').primaryKey(),
    title: text('title').notNull(),
    dek: text('dek').notNull(),
    category: text('category').notNull(),
    flag: text('flag'),
    authorSlug: text('author_slug').notNull().references(() => authors.slug),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('published'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    body: text('body').notNull(),
    readingMinutes: integer('reading_minutes').notNull(),
    cover: jsonb('cover').$type<Cover>().notNull(),
    faq: jsonb('faq').$type<FaqItem[]>().notNull().default([]),
    mentionedModelIds: text('mentioned_model_ids').array().notNull().default(sql`'{}'::text[]`),
    pullQuote: jsonb('pull_quote').$type<{ text: string; cite: string } | null>(),
  },
  (t) => [index('articles_published_idx').on(t.status, t.publishedAt), index('articles_category_idx').on(t.category, t.publishedAt)],
);

export const tools = pgTable('tools', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  pricing: text('pricing', { enum: ['Free', 'Freemium', 'Paid'] }).notNull(),
  rating: real('rating').notNull().default(0),
  /** Votes carried over from before user voting existed; user votes are added on top. */
  baseVotes: integer('base_votes').notNull().default(0),
  color: text('color').notNull(),
  letter: text('letter').notNull(),
  url: text('url').notNull(),
  runsOnVigas: boolean('runs_on_vigas').notNull().default(false),
  isNew: boolean('is_new').notNull().default(false),
  createdAt: createdAt(),
});

export const toolVotes = pgTable(
  'tool_votes',
  {
    toolSlug: text('tool_slug').notNull().references(() => tools.slug, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.toolSlug, t.userId] })],
);

// ── Arena & leaderboard ─────────────────────────────────────────────────────

export const arenaBattles = pgTable(
  'arena_battles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('overall'),
    prompt: text('prompt').notNull(),
    modelA: text('model_a').notNull(),
    modelB: text('model_b').notNull(),
    responseA: text('response_a').notNull(),
    responseB: text('response_b').notNull(),
    vote: text('vote', { enum: ['a', 'b', 'tie', 'bad'] }),
    createdAt: createdAt(),
    votedAt: timestamp('voted_at', { withTimezone: true }),
  },
  (t) => [index('battles_user_idx').on(t.userId, t.createdAt), index('battles_voted_idx').on(t.category, t.votedAt)],
);

export const leaderboardEntries = pgTable(
  'leaderboard_entries',
  {
    category: text('category').notNull(),
    modelId: text('model_id').notNull(),
    rank: integer('rank').notNull(),
    name: text('name').notNull(),
    org: text('org').notNull(),
    winRate: real('win_rate').notNull(),
    rating: real('rating').notNull(),
    ci: real('ci').notNull(),
    costPerTaskMicros: micros('cost_per_task_micros').notNull(),
    votes: integer('votes').notNull(),
    trend: jsonb('trend').$type<number[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.category, t.modelId] })],
);

export const leaderboardMeta = pgTable('leaderboard_meta', {
  category: text('category').primaryKey(),
  totalSessions: bigint('total_sessions', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
