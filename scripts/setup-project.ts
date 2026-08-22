/**
 * scripts/setup-project.ts
 * ---------------------------------------------------------------------------
 * The steps a fresh Supabase project needs after the migrations land.
 *
 * Separate from apply-migrations.ts because these are not schema: they are the
 * one-off reconciliations that a migration cannot express.
 *
 *   1. Backfill `profiles` for users who already existed in `auth.users`.
 *      The migration installs a trigger, and a trigger only fires on INSERT — so
 *      every account created before it existed has no profile row. Those users
 *      would sign in and find a broken app: loadProfile returns nothing and the
 *      admin check cannot find them. Matters most on a database shared with
 *      another application, where the accounts predate us entirely.
 *
 *   2. Report the buckets, so it is visible whether the Storage side of the
 *      migrations actually took effect.
 *
 *   3. Optionally make one account an operator (--admin=email), which is the only
 *      way in: there is deliberately no endpoint that grants it.
 *
 * Read-only unless something is genuinely missing, and safe to re-run.
 *
 *   npx deno run --allow-all --env-file=.env scripts/setup-project.ts
 *   npx deno run --allow-all --env-file=.env scripts/setup-project.ts --admin=me@example.com
 * ---------------------------------------------------------------------------
 */

const TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const REF = Deno.env.get("SUPABASE_PROJECT_REF");

if (!TOKEN || !REF) {
  console.error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must both be set.");
  Deno.exit(1);
}

const adminArg = Deno.args.find((a) => a.startsWith("--admin="))?.split("=")[1];

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

console.log(`Project: ${REF}\n`);

// ── 1. Profiles for accounts that predate the trigger.
const missing = await sql<{ n: number }>(`
  select count(*)::int as n
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null
`);
const before = missing[0]?.n ?? 0;

if (before === 0) {
  console.log("profiles: every auth user already has one");
} else {
  console.log(`profiles: ${before} auth users have no profile — backfilling`);
  const inserted = await sql<{ id: string }>(`
    insert into public.profiles (id, email)
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null and u.email is not null
    returning id
  `);
  console.log(`profiles: created ${inserted.length}`);

  const stillMissing = await sql<{ n: number }>(`
    select count(*)::int as n from auth.users u
    left join public.profiles p on p.id = u.id where p.id is null
  `);
  if ((stillMissing[0]?.n ?? 0) > 0) {
    // Accounts with no email address (phone or anonymous sign-ins) cannot be
    // backfilled by this query. Said rather than left as a silent shortfall.
    console.log(`profiles: ${stillMissing[0].n} still without one (no email address — phone or anonymous accounts)`);
  }
}

// ── 2. Buckets.
const buckets = await sql<{ id: string; public: boolean; file_size_limit: number | null }>(
  "select id, public, file_size_limit from storage.buckets order by id",
);
console.log(`\nbuckets: ${buckets.length}`);
for (const bucket of buckets) {
  console.log(`  ${bucket.id.padEnd(20)} public=${bucket.public}  cap=${bucket.file_size_limit ?? "none"}`);
}

const wanted = ["project-files", "agent-checkpoints", "shared-apps"];
const absent = wanted.filter((name) => !buckets.some((b) => b.id === name));
if (absent.length) console.log(`  MISSING: ${absent.join(", ")}`);

// `shared-apps` must be private: Storage serves text/html as text/plain from a
// public bucket, which is why share-page exists to serve it instead.
const shared = buckets.find((b) => b.id === "shared-apps");
if (shared?.public) {
  console.log("  shared-apps is PUBLIC — it must be private, or shared pages serve as plain text");
}

// ── 3. Seed data the app reads instead of hardcoded constants.
const seeded = await sql<{ plans: number; models: number }>(`
  select (select count(*)::int from public.plans) as plans,
         (select count(*)::int from public.models) as models
`);
console.log(`\nseeded: ${seeded[0]?.plans ?? 0} plans, ${seeded[0]?.models ?? 0} models`);

// ── 4. The operator flag.
if (adminArg) {
  const updated = await sql<{ email: string }>(`
    update public.profiles set is_admin = true
    where lower(email) = lower('${adminArg.replace(/'/g, "''")}')
    returning email
  `);
  console.log(updated.length
    ? `\nadmin: ${updated[0].email} can now open the panel`
    : `\nadmin: no profile with email ${adminArg} — sign up in the app first, then re-run with --admin`);
} else {
  const admins = await sql<{ email: string }>(
    "select email from public.profiles where is_admin order by email",
  );
  console.log(`\nadmins: ${admins.length ? admins.map((a) => a.email).join(", ") : "none yet (pass --admin=you@example.com)"}`);
}
