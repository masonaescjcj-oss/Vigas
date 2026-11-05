CREATE TABLE "news_items" (
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
CREATE TABLE "news_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_sources_feed_url_unique" UNIQUE("feed_url")
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_source_guid_idx" ON "news_items" USING btree ("source_id","guid");--> statement-breakpoint
CREATE INDEX "news_items_status_idx" ON "news_items" USING btree ("status","created_at");