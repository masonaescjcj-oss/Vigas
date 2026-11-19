# Issac — Supabase backend (schema, RLS, auth)

Migrations for the Issac AI coding-agent app: schema, multi-tenant Row Level
Security, auth automation, and performance indexes. Every file is plain SQL and
runs directly in Supabase — no placeholders.

## Apply

```bash
# with the Supabase CLI (local dev)
supabase db reset          # runs supabase/migrations/*.sql in order
supabase test db           # runs supabase/tests/rls.test.sql (pgTAP)

# or against any Postgres, in order:
for f in supabase/migrations/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Run order: `001_profiles` → `002_projects` → `003_agent_sessions` →
`004_agent_tasks` → `005_checkpoints` → `006_subscriptions` →
`007_usage_metering` → `008_rls_policies` → `009_triggers` → `010_indexes` →
`20260720123240_operational_backend`. The final migration is additive: it adds
the transcript fields required by `src/core/agent`, fixes the project
`updated_at` trigger contract, provisions private Storage buckets, enables
Realtime on `agent_tasks`, installs the atomic Edge limiter, and schedules the
UTC midnight Free-tier reset.

## Schema

Seven tables: `profiles`, `projects`, `agent_sessions`, `agent_tasks`,
`checkpoints`, `subscriptions`, `usage_metering`. The agent core
(`src/core/agent/`) reads/writes `agent_sessions`, `agent_tasks`, and
`checkpoints`. Generated TS types are in `supabase/types.ts` (regenerate with
`supabase gen types typescript`).

## Security model (all verified)

- **RLS is enabled on every table** — isolation is enforced in the database, not
  the app.
- **Every policy uses `(select auth.uid())`**, the optimized form that the
  planner evaluates once per query instead of once per row.
- `agent_sessions` / `agent_tasks` authorize through the ownership chain
  (`project_id → projects.user_id`) with `EXISTS` subqueries.
- **Sensitive tables are read-only to clients.** `checkpoints`, `subscriptions`,
  and `usage_metering` have no client write policy — only the backend
  (`service_role`, e.g. an Edge Function or the RevenueCat webhook) can write
  them.
- Every RLS foreign-key column (`user_id`, `project_id`, `session_id`) is
  indexed (see `010_indexes.sql`).
- Agent task writes are backend-only in the Data API; clients receive live
  status through the RLS-protected Realtime publication.

## Edge Functions

The executable Deno functions live in `supabase/functions/`. Their environment
variables, RevenueCat webhook authorization, SSE contract, Storage-backed
workspace, and deployment commands are documented in
[`functions/README.md`](functions/README.md).

`supabase/tests/rls.test.sql` proves the above with 15 pgTAP scenarios (user A
cannot read or write any of user B's rows; clients cannot write the sensitive
tables). The same scenarios were validated end-to-end against Postgres 16.

## Auth

- Providers: Email/Password, Google, and **Apple** (required by App Store rules
  when offering third-party sign-in on iOS). See `config.toml`.
- On signup, the `on_auth_user_created` trigger (`009_triggers.sql`) creates the
  user's `profiles` row and an initial free-tier `usage_metering` period.
- Sessions use a 1-hour access token with **refresh-token rotation** enabled
  (`config.toml`).
