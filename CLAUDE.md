# Vigas

The project owner writes in Persian (Farsi). Reply in Persian. Keep code, identifiers and commit messages in English.

## What Vigas is

One brand on three surfaces, sharing one backend and one user account:

- **Website**: public pages. SEO matters here.
- **Web app**: the logged-in experience in the browser.
- **Android app**

## Product pillars

1. **API gateway**: sell access to many AI models' APIs, exactly like OpenRouter. One OpenAI-compatible endpoint, prepaid credits, API keys, per-token prices, and routing/fallback across providers.
2. **AI leaderboard**: public rankings of AI models and agents, built from real sessions and blind Arena votes.
3. **AI news**: AI news and analysis. Its main job is SEO and organic traffic.
4. **Tools directory**: new, trending and well-known AI tools. Serves SEO and content.
5. **RetroBuild**: will be merged with https://retrobuild.space/ — an agent that builds an app from a description, with a checkpoint per step, billed to the user's Vigas credits.
6. **Vigas Chat**: the built-in chatbot. Its Arena mode (two hidden models, user votes) feeds the leaderboard.

## Architecture

pnpm + Turborepo monorepo (`node-linker=hoisted` for React Native). Roadmap and status: `docs/PLAN.md` (Persian).

| Path | What |
|---|---|
| `apps/web` | Next.js 16 website + web app, and the app API (`/api/app/*`, `/api/auth/*`) used by Android. Read `apps/web/AGENTS.md` before changing it: Next 16 differs from older versions. |
| `apps/mobile` | Expo SDK 58 / React Native Android app (expo-router, `src/app`). Read `apps/mobile/AGENTS.md`; install packages with `npx expo install`. |
| `apps/gateway` | Hono OpenAI-compatible gateway (`/v1/models`, `/v1/chat/completions`, `/v1/credits`). Website chat/Arena call it with `INTERNAL_SERVICE_TOKEN` + `X-Vigas-Account` + `X-Vigas-Source`. |
| `packages/core` | Pure TS shared by all: money (integer micro-dollars), routing/fallback, Bradley–Terry + Pareto, OpenAI request schema, app API types (`app-api.ts`), seed data. `@vigas/core/server` is Node-only crypto (keys, passwords, sessions). |
| `packages/db` | Drizzle schema, migrations (`drizzle/`), queries, seed, leaderboard job. Server-only. |
| `packages/tokens` | Design tokens (Graphite palette, fonts, org colors). |
| `packages/api-client` | Typed client for the app API (Android + web client components). |
| `design/premium` | Approved design canvas sources (`*.dc.html`), one file per screen. `design/vigas_v2.html` is the older v2 prototype. |

Workspace packages export TypeScript source (no build step); the gateway bundles them with tsup, Next transpiles them.

## Commands

- Local DB: `pnpm db:up` (Postgres 16 on port 5433, data in `.pgdata`, no Docker), then `pnpm db:migrate && pnpm db:seed`. Demo login `demo@vigas.ai` / `vigas-demo-2026`.
- `pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Tests need Postgres: db tests use `vigas_test`, gateway tests create `vigas_gateway_test`; both reset their schema.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate` and commit the new SQL in `packages/db/drizzle/`.
- New API key: `pnpm --filter @vigas/db create-key <email> [name]`.

## Rules of thumb

- Money is always integer micro-dollars; never floats in the ledger. Reserve with `reserveCredits`, settle with `settleUsage`.
- API keys and session tokens are stored only as SHA-256 hashes.
- Content pages must stay server-rendered with metadata and JSON-LD (SEO).
- Seeded news is demo content from the prototype and must be replaced before launch. Seeded `upstream_model` names are placeholders.
