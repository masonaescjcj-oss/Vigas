import { sql } from 'drizzle-orm';
import type { Db } from './client';

/**
 * Idempotent DDL statements that create the isolated `"vigas"` schema and all Vigas tables,
 * constraints, and indexes without ever touching `"public"` or any other schema on a shared
 * Postgres instance (such as Supabase projects hosting multiple apps).
 *
 * Embedded directly in TypeScript so it works reliably inside Vercel Serverless Functions
 * without depending on runtime filesystem access to `drizzle/*.sql`.
 */
const VIGAS_SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS "vigas"`,
  `CREATE TABLE IF NOT EXISTS "vigas"."users" (
    "id" text PRIMARY KEY NOT NULL,
    "email" text NOT NULL,
    "name" text,
    "password_hash" text NOT NULL,
    "role" text DEFAULT 'user' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE("email")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "vigas"."users"("id") ON DELETE cascade,
    "token_hash" text NOT NULL,
    "user_agent" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."accounts" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "vigas"."users"("id") ON DELETE cascade,
    "balance_micros" bigint DEFAULT 0 NOT NULL,
    "lifetime_topup_micros" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "accounts_user_id_unique" UNIQUE("user_id")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."api_keys" (
    "id" text PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "key_hash" text NOT NULL,
    "display" text NOT NULL,
    "monthly_limit_micros" bigint,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."ledger_entries" (
    "id" bigserial PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "amount_micros" bigint NOT NULL,
    "kind" text NOT NULL,
    "reference" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."credit_holds" (
    "id" text PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "amount_micros" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "released_at" timestamp with time zone
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."topups" (
    "id" text PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "amount_micros" bigint NOT NULL,
    "fee_micros" bigint NOT NULL,
    "provider" text NOT NULL,
    "provider_ref" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."usage_events" (
    "id" bigserial PRIMARY KEY NOT NULL,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "api_key_id" text REFERENCES "vigas"."api_keys"("id") ON DELETE set null,
    "source" text NOT NULL,
    "model_id" text NOT NULL,
    "provider" text NOT NULL,
    "prompt_tokens" integer DEFAULT 0 NOT NULL,
    "completion_tokens" integer DEFAULT 0 NOT NULL,
    "cost_micros" bigint DEFAULT 0 NOT NULL,
    "latency_ms" integer DEFAULT 0 NOT NULL,
    "status" text NOT NULL,
    "error_code" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."oauth_codes" (
    "code_hash" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "vigas"."users"("id") ON DELETE cascade,
    "account_id" text NOT NULL REFERENCES "vigas"."accounts"("id") ON DELETE cascade,
    "app_name" text NOT NULL,
    "callback_url" text NOT NULL,
    "code_challenge" text NOT NULL,
    "challenge_method" text NOT NULL,
    "key_limit_micros" bigint,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."models" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "org" text NOT NULL,
    "context_length" integer NOT NULL,
    "input_per_million_micros" bigint NOT NULL,
    "output_per_million_micros" bigint NOT NULL,
    "tags" text[] DEFAULT '{}'::text[] NOT NULL,
    "price_change_24h" real DEFAULT 0 NOT NULL,
    "auto" boolean DEFAULT false NOT NULL,
    "description" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."model_endpoints" (
    "id" serial PRIMARY KEY NOT NULL,
    "model_id" text NOT NULL REFERENCES "vigas"."models"("id") ON DELETE cascade,
    "provider" text NOT NULL,
    "upstream_model" text NOT NULL,
    "input_per_million_micros" bigint NOT NULL,
    "output_per_million_micros" bigint NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."authors" (
    "slug" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "role" text NOT NULL,
    "color" text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."articles" (
    "slug" text PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "dek" text NOT NULL,
    "category" text NOT NULL,
    "lang" text DEFAULT 'en' NOT NULL,
    "flag" text,
    "author_slug" text NOT NULL REFERENCES "vigas"."authors"("slug"),
    "status" text DEFAULT 'published' NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "body" text NOT NULL,
    "reading_minutes" integer NOT NULL,
    "cover" jsonb NOT NULL,
    "faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "mentioned_model_ids" text[] DEFAULT '{}'::text[] NOT NULL,
    "pull_quote" jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."news_sources" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "feed_url" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "last_fetched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "news_sources_feed_url_unique" UNIQUE("feed_url")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."news_items" (
    "id" serial PRIMARY KEY NOT NULL,
    "source_id" integer NOT NULL REFERENCES "vigas"."news_sources"("id") ON DELETE cascade,
    "guid" text NOT NULL,
    "title" text NOT NULL,
    "url" text NOT NULL,
    "summary" text DEFAULT '' NOT NULL,
    "published_at" timestamp with time zone,
    "status" text DEFAULT 'new' NOT NULL,
    "article_slug" text,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."tools" (
    "slug" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "tagline" text NOT NULL,
    "description" text NOT NULL,
    "category" text NOT NULL,
    "pricing" text NOT NULL,
    "rating" real DEFAULT 0 NOT NULL,
    "base_votes" integer DEFAULT 0 NOT NULL,
    "color" text NOT NULL,
    "letter" text NOT NULL,
    "image_url" text,
    "highlights" text[] DEFAULT '{}'::text[] NOT NULL,
    "url" text NOT NULL,
    "runs_on_vigas" boolean DEFAULT false NOT NULL,
    "is_new" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."tool_votes" (
    "tool_slug" text NOT NULL REFERENCES "vigas"."tools"("slug") ON DELETE cascade,
    "user_id" text NOT NULL REFERENCES "vigas"."users"("id") ON DELETE cascade,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "tool_votes_tool_slug_user_id_pk" PRIMARY KEY("tool_slug","user_id")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."arena_battles" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "vigas"."users"("id") ON DELETE cascade,
    "category" text DEFAULT 'overall' NOT NULL,
    "prompt" text NOT NULL,
    "model_a" text NOT NULL,
    "model_b" text NOT NULL,
    "response_a" text NOT NULL,
    "response_b" text NOT NULL,
    "vote" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "voted_at" timestamp with time zone
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."leaderboard_entries" (
    "category" text NOT NULL,
    "model_id" text NOT NULL,
    "rank" integer NOT NULL,
    "name" text NOT NULL,
    "org" text NOT NULL,
    "win_rate" real NOT NULL,
    "rating" real NOT NULL,
    "ci" real NOT NULL,
    "cost_per_task_micros" bigint NOT NULL,
    "votes" integer NOT NULL,
    "trend" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "leaderboard_entries_category_model_id_pk" PRIMARY KEY("category","model_id")
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."leaderboard_meta" (
    "category" text PRIMARY KEY NOT NULL,
    "total_sessions" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."upstream_providers" (
    "slug" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "kind" text DEFAULT 'openai' NOT NULL,
    "base_url" text NOT NULL,
    "key_strategy" text DEFAULT 'sticky' NOT NULL,
    "allowed_models" text[],
    "hidden" boolean DEFAULT true NOT NULL,
    "public_label" text DEFAULT 'vigas-edge' NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "vigas"."upstream_keys" (
    "id" text PRIMARY KEY NOT NULL,
    "provider_slug" text NOT NULL REFERENCES "vigas"."upstream_providers"("slug") ON DELETE cascade,
    "label" text NOT NULL,
    "key_ciphertext" text NOT NULL,
    "key_hint" text NOT NULL,
    "key_hash" text NOT NULL,
    "budget_micros" bigint,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "api_keys_account_idx" ON "vigas"."api_keys" USING btree ("account_id")`,
  `CREATE INDEX IF NOT EXISTS "battles_user_idx" ON "vigas"."arena_battles" USING btree ("user_id","created_at")`,
  `CREATE INDEX IF NOT EXISTS "battles_voted_idx" ON "vigas"."arena_battles" USING btree ("category","voted_at")`,
  `CREATE INDEX IF NOT EXISTS "articles_published_idx" ON "vigas"."articles" USING btree ("status","published_at")`,
  `CREATE INDEX IF NOT EXISTS "articles_category_idx" ON "vigas"."articles" USING btree ("category","published_at")`,
  `CREATE INDEX IF NOT EXISTS "holds_open_idx" ON "vigas"."credit_holds" USING btree ("created_at") WHERE "vigas"."credit_holds"."released_at" is null`,
  `CREATE INDEX IF NOT EXISTS "ledger_account_idx" ON "vigas"."ledger_entries" USING btree ("account_id","created_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "endpoint_model_provider_idx" ON "vigas"."model_endpoints" USING btree ("model_id","provider")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "news_items_source_guid_idx" ON "vigas"."news_items" USING btree ("source_id","guid")`,
  `CREATE INDEX IF NOT EXISTS "news_items_status_idx" ON "vigas"."news_items" USING btree ("status","created_at")`,
  `CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "vigas"."sessions" USING btree ("user_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "upstream_keys_provider_hash_idx" ON "vigas"."upstream_keys" USING btree ("provider_slug","key_hash")`,
  `CREATE INDEX IF NOT EXISTS "upstream_keys_provider_idx" ON "vigas"."upstream_keys" USING btree ("provider_slug","enabled")`,
  `CREATE INDEX IF NOT EXISTS "usage_account_idx" ON "vigas"."usage_events" USING btree ("account_id","created_at")`,
  `CREATE INDEX IF NOT EXISTS "usage_key_idx" ON "vigas"."usage_events" USING btree ("api_key_id","created_at")`,
];

/** Ensures the isolated `"vigas"` schema and all 22 tables/indexes exist safely and idempotently. */
export async function ensureVigasSchema(db: Db): Promise<void> {
  for (const stmt of VIGAS_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}
