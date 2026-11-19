/**
 * scripts/cloud-check.ts
 * ---------------------------------------------------------------------------
 * Health check for the deployed backend. Verifies, in order:
 *   1. every edge function is deployed (404 vs auth-rejection)
 *   2. the cron -> pg_net -> queue-worker invocation actually runs
 *   3. the deployed queue-worker accepts the worker secret from .env
 *   4. no jobs are stuck pending
 *
 *   npx deno run --allow-all --env-file=.env scripts/cloud-check.ts
 * ---------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(SUPABASE_URL, SERVICE);

const FUNCTIONS = [
  "agent-run", "agent-resume", "agent-fork", "queue-worker", "project-files",
  "projects-create", "projects-list", "projects-update", "projects-delete",
  "checkpoint-create", "checkpoint-restore", "revenuecat-webhook",
  "revenuecat-sync", "usage-check",
];

let failures = 0;
const fail = (message: string) => { failures += 1; console.log(`   ✗ ${message}`); };
const ok = (message: string) => console.log(`   ✓ ${message}`);

console.log("1) Edge functions deployed?");
for (const name of FUNCTIONS) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: "{}",
  });
  const body = await res.text();
  if (res.status === 404 && /NOT_FOUND|not found/i.test(body)) fail(`${name} is NOT deployed`);
  else ok(`${name} (HTTP ${res.status})`);
}

console.log("\n2) cron -> pg_net -> queue-worker invocation");
const { data: netId, error: rpcError } = await client.rpc("invoke_queue_worker");
if (rpcError) fail(`invoke_queue_worker() failed: ${rpcError.message} (Vault secrets missing?)`);
else ok(`invoke_queue_worker() fired (pg_net request ${netId})`);

console.log("\n3) Does the deployed worker accept the .env worker secret?");
const secret = Deno.env.get("QUEUE_WORKER_SECRET_V2") ?? Deno.env.get("QUEUE_WORKER_SECRET");
if (!secret) fail("no QUEUE_WORKER_SECRET(_V2) in .env");
else {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/queue-worker`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", apikey: ANON },
    body: "{}",
  });
  if (res.status === 202) ok("worker accepted the secret");
  else {
    fail(
      `worker rejected the secret (HTTP ${res.status}). The cloud edge secret, the Vault ` +
      `secret 'queue_worker_secret', and .env must all hold the SAME value. ` +
      `Remember QUEUE_WORKER_SECRET_V2 takes precedence over QUEUE_WORKER_SECRET in the function.`,
    );
  }
}

console.log("\n4) Stuck jobs?");
const cutoff = new Date(Date.now() - 120_000).toISOString();
const { data: stuck } = await client.from("job_queue")
  .select("id,status,attempts,created_at").eq("status", "pending").lt("created_at", cutoff);
if (stuck?.length) fail(`${stuck.length} job(s) pending for over 2 minutes — the cloud worker is not consuming the queue`);
else ok("no jobs stuck pending");

console.log(failures === 0 ? "\nALL CHECKS PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
Deno.exit(failures === 0 ? 0 : 1);
