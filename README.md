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

## Running it locally

Three processes. The functions run on this machine; Postgres, Auth and Storage
stay on the Supabase project named in `.env`, so a local run exercises the real
database rather than a stub.

```bash
npx deno run --allow-all --env-file=.env local-api-server.ts
```

```bash
npx deno run --allow-all --env-file=.env run-local-worker.ts
```

```bash
npx expo start --web --port 8082
```

The app reaches the local gateway because `EXPO_PUBLIC_API_URL` is set to
`http://localhost:54321/functions/v1`; unset it and the same build talks to the
deployed project instead. Two things to know:

- The worker runs *alongside* the Cron-invoked one in the cloud. Both claim jobs
  atomically, so this is safe, but a job you enqueue locally may well be run by
  the deployed worker — check which one logged it before concluding a local edit
  had no effect.
- `LOCAL_DEV_BYPASS` skips auth entirely and belongs only here. It is a full
  bypass, so it must never be set as a Function secret on a deployed project;
  `scripts/check-share.ts` notes which assertions it makes unassertable.

Don't pipe a long-running process through `tail` — it buffers until the pipe
closes, so a server that never exits appears to produce no output at all.

## Building the web app

The app is React Native Web, so `expo export` produces a static site that any
host can serve.

```bash
npx expo export --platform web --output-dir dist-web --clear
```

It needs a `.env.production`, because `expo export` runs with
`NODE_ENV=production` and loads that file ahead of `.env`. Without it the local
gateway URL from `.env` is compiled into the bundle, and every device that opens
the build points at *its own* machine — the app loads, then fails on the first
request. Measured, not theorised: the first export shipped
`localhost:54321/functions/v1`.

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
EXPO_PUBLIC_API_URL=https://<ref>.supabase.co/functions/v1
EXPO_PUBLIC_DISTRIBUTION=web
```

Everything in that file is readable in the shipped JS. The anon key is public by
design; a service role key must never appear in an `EXPO_PUBLIC_` variable.

Two things worth checking on every export, both of which have already gone
wrong once:

```bash
# 1. The bundle must not carry the local gateway.
grep -c "localhost:54321" dist-web/_expo/static/js/web/AppEntry-*.js

# 2. No server-side secret may appear anywhere in the output.
grep -rF "$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2)" dist-web
```

`--clear` is not optional when the env has changed. Metro will otherwise return
a cached bundle built with the old values, which looks exactly like the new file
being ignored.

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
