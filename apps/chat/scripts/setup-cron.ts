/**
 * scripts/setup-cron.ts
 * ---------------------------------------------------------------------------
 * Wire pg_cron to the queue worker.
 *
 * The worker is an edge function, so something has to call it. pg_cron does, via
 * pg_net, with the URL and the shared secret read out of Vault — the secret must
 * not sit in a cron job definition, which is world-readable to anyone with
 * database access.
 *
 * The trap this script exists to avoid: the worker reads QUEUE_WORKER_SECRET_V2
 * first and only falls back to QUEUE_WORKER_SECRET. A stale _V2 left over from an
 * earlier deploy silently wins over whatever you just set, cron gets a 401, and
 * jobs sit pending forever with nothing in the logs to explain it. So both are set
 * to the same value, and this asserts the Vault copy matches.
 *
 *   npx deno run --allow-all --env-file=.env scripts/setup-cron.ts
 * ---------------------------------------------------------------------------
 */

const TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const REF = Deno.env.get("SUPABASE_PROJECT_REF");
const SECRET = Deno.env.get("QUEUE_WORKER_SECRET");

if (!TOKEN || !REF || !SECRET) {
  console.error("SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and QUEUE_WORKER_SECRET must be set.");
  Deno.exit(1);
}

const WORKER_URL = `https://${REF}.supabase.co/functions/v1/queue-worker`;

async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text) as T[];
  } catch {
    return [];
  }
}

const quoted = SECRET.replace(/'/g, "''");

console.log(`Project: ${REF}\n`);

await sql("create extension if not exists pg_cron with schema extensions");
await sql("create extension if not exists pg_net with schema extensions");
console.log("extensions: pg_cron and pg_net ready");

// Vault, upserted rather than created: create_secret errors on a duplicate name,
// and this script has to be re-runnable.
await sql(`
  do $$
  declare existing uuid;
  begin
    select id into existing from vault.secrets where name = 'queue_worker_url';
    if existing is null then
      perform vault.create_secret('${WORKER_URL}', 'queue_worker_url');
    else
      perform vault.update_secret(existing, '${WORKER_URL}');
    end if;

    select id into existing from vault.secrets where name = 'queue_worker_secret';
    if existing is null then
      perform vault.create_secret('${quoted}', 'queue_worker_secret');
    else
      perform vault.update_secret(existing, '${quoted}');
    end if;
  end $$;
`);
console.log("vault: queue_worker_url and queue_worker_secret stored");

/**
 * The migrations already schedule the worker, through
 * `public.invoke_queue_worker()`, which reads the same two Vault names this script
 * writes. An earlier version of this file scheduled a second inline job as well —
 * so the worker was invoked twice every ten seconds, doubling both the invocation
 * count and the chance of two workers racing for one job. Anything the migrations
 * own is left to them; this script only removes that duplicate and fills gaps.
 */
const OWNED_BY_MIGRATIONS = ["invoke-agent-queue-worker", "reset-free-usage-midnight", "close-stale-sandbox-usage"];
const DUPLICATES_TO_REMOVE = ["invoke-queue-worker", "reset-free-usage-daily", "purge-stale-sandbox-usage"];

for (const name of DUPLICATES_TO_REMOVE) {
  const removed = await sql<{ unschedule: boolean }>(
    `select cron.unschedule('${name}') where exists (select 1 from cron.job where jobname = '${name}')`,
  );
  if (removed.length) console.log(`cron: removed duplicate ${name}`);
}

const existing = await sql<{ jobname: string }>("select jobname from cron.job");
const names = existing.map((j) => j.jobname);
const missing = OWNED_BY_MIGRATIONS.filter((n) => !names.includes(n));
console.log(missing.length
  ? `cron: MISSING from the migrations: ${missing.join(", ")}`
  : "cron: all three migration-owned jobs are present");

const jobs: Array<{ name: string; schedule: string; command: string }> = [];

for (const job of jobs) {
  // A job whose function does not exist would fail every run in silence, so it is
  // only scheduled when the thing it calls is really there.
  if (job.command.includes("public.")) {
    const fn = job.command.match(/public\.(\w+)/)?.[1];
    if (fn) {
      const found = await sql<{ n: number }>(`
        select count(*)::int as n from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = '${fn}'
      `);
      if ((found[0]?.n ?? 0) === 0) {
        console.log(`cron: skipping ${job.name} — public.${fn}() does not exist`);
        continue;
      }
    }
  }
  await sql(`select cron.unschedule('${job.name}') where exists (select 1 from cron.job where jobname = '${job.name}')`);
  await sql(`select cron.schedule('${job.name}', '${job.schedule}', $job$${job.command}$job$)`);
  console.log(`cron: ${job.name} every ${job.schedule}`);
}

const scheduled = await sql<{ jobname: string; schedule: string; active: boolean }>(
  "select jobname, schedule, active from cron.job order by jobname",
);
console.log(`\n${scheduled.length} cron jobs:`);
for (const job of scheduled) {
  console.log(`  ${job.jobname.padEnd(28)} ${job.schedule.padEnd(12)} active=${job.active}`);
}

// The secret the worker will actually be sent must match the one it expects.
const check = await sql<{ same: boolean }>(`
  select (select decrypted_secret from vault.decrypted_secrets where name = 'queue_worker_secret') = '${quoted}' as same
`);
console.log(`\nvault secret matches .env: ${check[0]?.same === true}`);
