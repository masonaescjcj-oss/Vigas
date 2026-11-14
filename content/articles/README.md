# Publishing Articles on Vigas

Vigas supports two ways to publish real articles to `/news`, `/news/[slug]`, `/news/category/[category]`, `/sitemap.xml`, `/news-sitemap.xml`, and `/feed.xml` — both with **no database** (file-based preview/static deployments) and **with Postgres**.

## Option 1: Markdown files (`content/articles/*.md`)

1. Copy [`_template.md`](./_template.md) to a new `.md` file in this folder, e.g. `claude-pricing-update.md`.
2. Fill in the YAML frontmatter:
   - `title`: Headline (ideally `<= 65` characters; use `"Main point — punchy tail"` to automatically italicize the second half in sand gold).
   - `slug`: Optional URL slug (defaults to the filename without `.md`).
   - `dek`: Subheadline / Google meta description (ideally `120–160` characters).
   - `category`: One of `Models`, `Agents`, `Analysis`, `Policy`, `Hardware`, `Funding`, `Tools`.
   - `flag`: `null`, `"Breaking"`, `"Analysis"`, or `"Exclusive"`.
   - `authorSlug`: Known author slug (`sara-moradi`, `kian-rahimi`, `nima-farahani`, `leila-karimi`, `arman-tehrani`) or custom `authorName` / `authorRole` / `authorColor`.
   - `status`: `"published"` or `"draft"` (drafts stay hidden from public pages, sitemaps, and RSS).
   - `publishedAt`: ISO-8601 UTC timestamp, e.g. `"2026-11-15T09:00:00Z"`.
   - `cover`: `{"big":"2.4×","caption":"SPEEDUP","color":"#FF6A1A"}` (big figure `<= 8` chars, caption `<= 24` chars).
   - `mentionedModelIds`: Array of model IDs shown in the sidebar with live prices.
   - `pullQuote`: Optional `{"text":"...","cite":"..."}`.
   - `faq`: Array of `{"q":"...","a":"..."}` rendered visibly on the article and emitted as `FAQPage` JSON-LD.
3. Redeploy or restart Next.js (files prefixed with `_` such as `_template.md` and `README.md` are automatically ignored).

## Option 2: Admin News Desk (`/admin`)

When `DATABASE_URL` is configured and you sign in with an admin account (`role = 'admin'`):

- Open `/admin` and click **New article** (or import any `.md` file directly with **Import .md** inside the editor).
- Use the live Google SERP snippet preview and character counters to optimize headline/dek length before clicking **Publish**.
- Click **Export .md** at any time to download a clean Markdown backup compatible with `content/articles/`.

## Suppressing Prototype Demo Articles

Prototype stories from `packages/core/src/seed/news.ts` are **off by default** in DB-less mode so empty launches stay clean for search engines:

- Set `VIGAS_DEMO_NEWS=1` only if you want sample prototype stories shown alongside local Markdown files in preview mode.
- Set `VIGAS_PREVIEW_BANNER=1` only if you want the amber `PREVIEW · sample data` ribbon shown in DB-less mode.
- Running `pnpm db:seed` leaves Postgres clean with 0 articles by default; set `VIGAS_SEED_DEMO_NEWS=1` only if you intentionally want prototype sample stories seeded, or click **Clear demo articles** in `/admin` (`DELETE /api/admin/articles/demo`).
