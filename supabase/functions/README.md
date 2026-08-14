# Supabase Edge Functions

The complete backend architecture, deployment flow, E2B/Sentry secrets, Queue
worker Vault setup, Realtime contract, and security model are documented in the
repository [README.md](../../README.md).

All user-facing functions validate a Supabase Auth bearer JWT. The two
intentional exceptions are `revenuecat-webhook` (RevenueCat's configured
Authorization value) and `queue-worker` (the random `QUEUE_WORKER_SECRET`
bearer value delivered by pg_cron through Vault). Checkpoint functions require
the Supabase service/secret key and are never callable with a user JWT.

`agent-run` and `agent-resume` return HTTP 202 with a `job_id` and `session_id`;
they do not hold an SSE connection open. Subscribe to `public:agent_tasks` and
filter by `session_id` for live tool status. The worker writes `running`,
`success`, and `failed` rows and the queue row exposes retry/final error state.

Run the Deno tests with:

```bash
deno test --config supabase/functions/deno.json supabase/functions/tests
```
