CREATE TABLE IF NOT EXISTS "upstream_providers" (
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
CREATE TABLE IF NOT EXISTS "upstream_keys" (
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
DO $$ BEGIN
 ALTER TABLE "upstream_keys" ADD CONSTRAINT "upstream_keys_provider_slug_upstream_providers_slug_fk" FOREIGN KEY ("provider_slug") REFERENCES "public"."upstream_providers"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upstream_keys_provider_hash_idx" ON "upstream_keys" USING btree ("provider_slug","key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upstream_keys_provider_idx" ON "upstream_keys" USING btree ("provider_slug","enabled");
