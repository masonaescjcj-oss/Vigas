# Issac backend — four-phase architecture

This repository contains the production backend for the Issac coding agent.

1. **Agent Core** (`src/core/agent`) provides the policy-aware runtime, tools,
   sessions, checkpoints, plan execution, and audit hooks.
2. **Schema/RLS/Auth** (`supabase/migrations/001_*` through `010_*`) provides
   tenant isolation, private Storage buckets, Auth-triggered profiles, and
   usage metering.
3. **Edge API/RevenueCat** (`supabase/functions`) provides authenticated CRUD,
   RevenueCat webhook/sync, checkpoint APIs, and usage enforcement.
4. **Infrastructure** (`src/infra` and `supabase/functions/queue-worker`) runs
   user commands in isolated E2B sandboxes, records cost, captures Sentry
   errors/traces, and processes long jobs asynchronously.

## Runtime flow

`agent-run` validates the Supabase JWT, project ownership, rate limit, and Free
usage meter, creates the session if necessary, and inserts a `job_queue` row.
It immediately returns HTTP 202. A pg_cron job invokes `queue-worker` every ten
seconds through pg_net. The worker atomically claims one pending row, runs the
Agent Core against an E2B sandbox, writes tool/task status to `agent_tasks`, and
stores the final result. Failed attempts are rescheduled after 10, 30, and 60
seconds; the fourth failure is terminal. Clients subscribe to `agent_tasks` and
`job_queue` using Supabase Realtime with their normal Auth JWT.

Each session has at most one active E2B sandbox. The manager refreshes its
15-minute warm timeout on activity, kills commands with SIGKILL at 60 seconds,
enforces a memory limit, and records active/destroyed/error usage in
`sandbox_usage`. Free/Pro/Team daily and monthly budgets are enforced before a
sandbox is created.

## Required server secrets

Set these in Supabase Dashboard → Edge Functions → Secrets (never in a mobile or
web client):

| Secret | Purpose |
|---|---|
| `E2B_API_KEY` | E2B sandbox API key used only by Edge Functions |
| `SENTRY_DSN` | Sentry project DSN; `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` are optional |
| `QUEUE_WORKER_SECRET` | Random high-entropy bearer secret for pg_cron → queue-worker; `QUEUE_WORKER_SECRET_V2` is accepted first during zero-downtime rotation |
| `ANTHROPIC_API_KEY` | Agent model access |
| `REVENUECAT_API_KEY` | RevenueCat subscriber sync |
| `REVENUECAT_WEBHOOK_AUTH` | Exact RevenueCat Authorization value |

After setting `QUEUE_WORKER_SECRET`, create the matching Vault secrets with the
same value (the migration never stores the secret in source or cron metadata).
For example, bind the secret as the `worker_secret` psql variable and run:

```sql
select vault.create_secret(
  'https://qnrsiukutehcqjhmpuze.supabase.co/functions/v1/queue-worker',
  'queue_worker_url'
);
select vault.create_secret(:'worker_secret', 'queue_worker_secret');
```

The project URL should be replaced if the project reference changes. Rotate the
worker secret by updating both the Edge Function secret and the Vault secret.

## Deploy and verify

Apply migrations in order, then deploy the functions with the repository's
`supabase/functions/deno.json` import map. The three infrastructure migrations
create the queue and usage tables, atomic claim/complete/fail/accounting RPCs,
Realtime publication, foreign-key indexes, stale-lease recovery, and the
10-second worker Cron schedule.

```bash
npm run typecheck
npm test
deno test --config supabase/functions/deno.json supabase/functions/tests
supabase functions deploy queue-worker --no-verify-jwt
```

The worker deliberately uses custom bearer authentication because pg_cron is
not a Supabase Auth user. All other user-facing Functions validate a Supabase
JWT. `revenuecat-webhook` validates its configured Authorization header and
rejects missing/invalid credentials with 401.

Sentry transactions are named after each Function. The version-controlled rule
in `src/infra/monitoring/alerts.ts` should page on-call when the `agent-run`
error rate exceeds 5% in a five-minute production window.
