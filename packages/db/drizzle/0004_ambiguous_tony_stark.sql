ALTER TABLE "articles" ADD COLUMN "lang" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "highlights" text[] DEFAULT '{}'::text[] NOT NULL;