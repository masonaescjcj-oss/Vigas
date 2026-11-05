# Vigas

One key for every AI model — plus an AI leaderboard, AI news, a tools directory, RetroBuild and Vigas Chat.

- **Website & web app** — `apps/web` (Next.js 16, server-rendered for SEO)
- **Android app** — `apps/mobile` (React Native + Expo SDK 58)
- **API gateway** — `apps/gateway` (OpenAI-compatible, like OpenRouter)
- **Shared code** — `packages/core` (money, routing, rankings, API types), `packages/db` (Postgres + Drizzle), `packages/tokens` (design tokens), `packages/api-client` (typed app API client)

The full roadmap is in [docs/PLAN.md](docs/PLAN.md) (Persian). The approved design lives in [design/premium](design/premium).

## Quick start

Requirements: Node 22, pnpm 10, and PostgreSQL 16 (or Docker).

```bash
pnpm install
cp .env.example .env            # then edit as needed
pnpm db:up                      # local Postgres on port 5433 (no Docker needed)
pnpm db:migrate
pnpm db:seed                    # catalogue, demo news/tools, leaderboards, demo user
pnpm dev                        # web on :3000, gateway on :8787
```

Demo login (local seed only): `demo@vigas.ai` / `vigas-demo-2026`.
Create an API key for any user: `pnpm --filter @vigas/db create-key demo@vigas.ai "my key"`.

With Docker instead: `docker compose up --build` (Postgres, migrations, gateway, website).

## Using the API

```bash
curl https://api.vigas.ai/v1/chat/completions \
  -H "Authorization: Bearer $VIGAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "vigas/auto", "messages": [{"role": "user", "content": "Hello"}]}'
```

Any OpenAI SDK works with `base_url = https://api.vigas.ai/v1`. Extensions:

| Field | Meaning |
|---|---|
| `model: "vigas/auto"` | Let Vigas pick among auto-eligible models |
| `models: [...]` | Fallback models, tried in order |
| `route: { sort: "price" \| "latency" \| "quality", fallbacks: true }` | How providers are ordered |
| `usage.cost` | What the request cost, in USD |
| `X-Vigas-Provider`, `X-Vigas-Model` headers | Who served the request |

Without provider keys (local development) every model is answered by a clearly labelled mock provider. Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, … to use real providers, and check each model's `upstream_model` in the `model_endpoints` table — the seeded values are placeholders.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run every app in watch mode |
| `pnpm typecheck` / `pnpm test` / `pnpm build` | Checks across the monorepo (tests need Postgres) |
| `pnpm db:generate` | Create a migration after editing `packages/db/src/schema.ts` |
| `pnpm leaderboard:compute` | Recompute leaderboards from Arena votes (run on a schedule) |
| `pnpm --filter @vigas/mobile start` | Start the Expo dev server for the Android app |

## How money works

All amounts are integer micro-dollars. A request first reserves its maximum possible cost from the balance, then the real cost is charged and the rest refunded in one transaction. Holds left by crashed requests are refunded by the gateway every 5 minutes. Top-ups have no fee on a user's first $5, then `TOPUP_FEE_BPS` (default 5%).

## Deploying

- **Gateway:** `deploy/gateway.Dockerfile` (stateless; scale horizontally — move rate limiting to Redis first).
- **Website:** `deploy/web.Dockerfile`, or Vercel with the repo root and `apps/web` as the project.
- **Database:** any managed Postgres 16; run `pnpm db:migrate` on deploy.
- **Android:** `cd apps/mobile && npx eas-cli build -p android --profile production`.

Seeded news articles are demo content from the design prototype. Replace them with original reporting before launch.
