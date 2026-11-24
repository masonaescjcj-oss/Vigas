CREATE SCHEMA IF NOT EXISTS "vigas";
--> statement-breakpoint
CREATE TABLE "vigas"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance_micros" bigint DEFAULT 0 NOT NULL,
	"lifetime_topup_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "vigas"."api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"display" text NOT NULL,
	"monthly_limit_micros" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "vigas"."arena_battles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text DEFAULT 'overall' NOT NULL,
	"prompt" text NOT NULL,
	"model_a" text NOT NULL,
	"model_b" text NOT NULL,
	"response_a" text NOT NULL,
	"response_b" text NOT NULL,
	"vote" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vigas"."articles" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"dek" text NOT NULL,
	"category" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"flag" text,
	"author_slug" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"body" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"cover" jsonb NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentioned_model_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"pull_quote" jsonb
);
--> statement-breakpoint
CREATE TABLE "vigas"."authors" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."credit_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount_micros" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vigas"."leaderboard_entries" (
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
);
--> statement-breakpoint
CREATE TABLE "vigas"."leaderboard_meta" (
	"category" text PRIMARY KEY NOT NULL,
	"total_sessions" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount_micros" bigint NOT NULL,
	"kind" text NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."model_endpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"upstream_model" text NOT NULL,
	"input_per_million_micros" bigint NOT NULL,
	"output_per_million_micros" bigint NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."models" (
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
);
--> statement-breakpoint
CREATE TABLE "vigas"."news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"guid" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"status" text DEFAULT 'new' NOT NULL,
	"article_slug" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."news_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_sources_feed_url_unique" UNIQUE("feed_url")
);
--> statement-breakpoint
CREATE TABLE "vigas"."oauth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"app_name" text NOT NULL,
	"callback_url" text NOT NULL,
	"code_challenge" text NOT NULL,
	"challenge_method" text NOT NULL,
	"key_limit_micros" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vigas"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "vigas"."tool_votes" (
	"tool_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_votes_tool_slug_user_id_pk" PRIMARY KEY("tool_slug","user_id")
);
--> statement-breakpoint
CREATE TABLE "vigas"."tools" (
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
);
--> statement-breakpoint
CREATE TABLE "vigas"."topups" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount_micros" bigint NOT NULL,
	"fee_micros" bigint NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vigas"."upstream_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_slug" text NOT NULL,
	"label" text NOT NULL,
	"key_ciphertext" text NOT NULL,
	"key_hint" text NOT NULL,
	"key_hash" text NOT NULL,
	"budget_micros" bigint,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigas"."upstream_providers" (
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
);
--> statement-breakpoint
CREATE TABLE "vigas"."usage_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"api_key_id" text,
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
);
--> statement-breakpoint
CREATE TABLE "vigas"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "vigas"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "vigas"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."arena_battles" ADD CONSTRAINT "arena_battles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "vigas"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."articles" ADD CONSTRAINT "articles_author_slug_authors_slug_fk" FOREIGN KEY ("author_slug") REFERENCES "vigas"."authors"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."credit_holds" ADD CONSTRAINT "credit_holds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."model_endpoints" ADD CONSTRAINT "model_endpoints_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "vigas"."models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."news_items" ADD CONSTRAINT "news_items_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "vigas"."news_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "vigas"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."oauth_codes" ADD CONSTRAINT "oauth_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "vigas"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."tool_votes" ADD CONSTRAINT "tool_votes_tool_slug_tools_slug_fk" FOREIGN KEY ("tool_slug") REFERENCES "vigas"."tools"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."tool_votes" ADD CONSTRAINT "tool_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "vigas"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."topups" ADD CONSTRAINT "topups_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."upstream_keys" ADD CONSTRAINT "upstream_keys_provider_slug_upstream_providers_slug_fk" FOREIGN KEY ("provider_slug") REFERENCES "vigas"."upstream_providers"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."usage_events" ADD CONSTRAINT "usage_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "vigas"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigas"."usage_events" ADD CONSTRAINT "usage_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "vigas"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_account_idx" ON "vigas"."api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "battles_user_idx" ON "vigas"."arena_battles" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "battles_voted_idx" ON "vigas"."arena_battles" USING btree ("category","voted_at");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "vigas"."articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "vigas"."articles" USING btree ("category","published_at");--> statement-breakpoint
CREATE INDEX "holds_open_idx" ON "vigas"."credit_holds" USING btree ("created_at") WHERE "vigas"."credit_holds"."released_at" is null;--> statement-breakpoint
CREATE INDEX "ledger_account_idx" ON "vigas"."ledger_entries" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoint_model_provider_idx" ON "vigas"."model_endpoints" USING btree ("model_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_source_guid_idx" ON "vigas"."news_items" USING btree ("source_id","guid");--> statement-breakpoint
CREATE INDEX "news_items_status_idx" ON "vigas"."news_items" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "vigas"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upstream_keys_provider_hash_idx" ON "vigas"."upstream_keys" USING btree ("provider_slug","key_hash");--> statement-breakpoint
CREATE INDEX "upstream_keys_provider_idx" ON "vigas"."upstream_keys" USING btree ("provider_slug","enabled");--> statement-breakpoint
CREATE INDEX "usage_account_idx" ON "vigas"."usage_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_key_idx" ON "vigas"."usage_events" USING btree ("api_key_id","created_at");