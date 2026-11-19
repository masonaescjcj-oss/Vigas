/**
 * scripts/apply-migrations.ts
 * ---------------------------------------------------------------------------
 * Apply every migration to a Supabase project using the Management API.
 *
 * `supabase db push` needs the database password. The Management API's query
 * endpoint needs only a personal access token, which is the credential an operator
 * actually has to hand — so this is the path that works when the CLI's does not.
 *
 * Written as a script rather than run by hand because a migration is a whole SQL
 * file, and JSON-escaping one through a shell is exactly where a stray backslash
 * silently corrupts a statement. Here the escaping is JSON.stringify's problem.
 *
 * SAFETY
 *
 * It prints the target project and what is already in it, and refuses to continue
 * unless the ref matches SUPABASE_PROJECT_REF. That matters because a token reaches
 * every project on the account, and the database being changed may well be shared
 * with another live application — every migration here is additive (`if not exists`,
 * and the only drops are of our own policies and triggers), but "additive" is a
 * property to verify against the target, not to assume.
 *
 * Re-runnable: every migration is idempotent, so a second run is a no-op.
 *
 *   npx deno run --allow-all --env-file=.env scripts/apply-migrations.ts
 *   npx deno run --allow-all --env-file=.env scripts/apply-migrations.ts --dry-run
 * ---------------------------------------------------------------------------
 */

const TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const REF = Deno.env.get("SUPABASE_PROJECT_REF");
const DRY = Deno.args.includes("--dry-run");

if (!TOKEN || !REF) {
  console.error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must both be set.");
  Deno.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}`;

/**
 * Cloudflare sits in front of the Management API and refuses requests with no
 * User-Agent — with a 403 whose body is Cloudflare's "error code: 1010", not an
 * auth error. It looks exactly like a revoked token, and cost an afternoon of
 * believing the token had been revoked when it had not.
 */
const AGENT = "retro-code-migrations/1.0";

async function sql(query: string): Promise<{ ok: boolean; rows?: unknown[]; error?: string }> {
  const response = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": AGENT,
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text);
      message = parsed.message ?? parsed.error ?? message;
    } catch { /* not JSON */ }
    return { ok: false, error: `${response.status}: ${message}` };
  }
  try {
    return { ok: true, rows: JSON.parse(text) };
  } catch {
    return { ok: true, rows: [] };
  }
}

// ── Say out loud which database is about to change, and what is already there.
const project = await fetch(`https://api.supabase.com/v1/projects`, {
  headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": AGENT },
}).then((r) => r.json()).catch(() => null);
const match = Array.isArray(project) ? project.find((p: { id: string }) => p.id === REF) : null;
if (!match) {
  console.error(`Project ${REF} is not visible to this token. Refusing to guess.`);
  Deno.exit(1);
}
console.log(`Target: ${REF}  (${match.name})  region=${match.region}  status=${match.status}`);

const before = await sql(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
const existing = (before.rows ?? []).map((r) => (r as { table_name: string }).table_name);
console.log(`Already in public: ${existing.length} tables`);
if (existing.length) console.log(`  ${existing.join(", ")}`);
console.log("");

// ── The files, in name order, which is also dependency order.
const files: string[] = [];
for await (const entry of Deno.readDir("supabase/migrations")) {
  if (entry.isFile && entry.name.endsWith(".sql")) files.push(entry.name);
}
files.sort();

console.log(`${files.length} migrations to apply${DRY ? " (dry run — nothing will be sent)" : ""}\n`);

let applied = 0;
let failed = 0;

for (const name of files) {
  const body = await Deno.readTextFile(`supabase/migrations/${name}`);
  if (DRY) {
    console.log(`WOULD  ${name}  (${body.length} bytes)`);
    continue;
  }
  const result = await sql(body);
  if (result.ok) {
    applied += 1;
    console.log(`OK     ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL   ${name}\n         ${result.error}`);
    // Stop at the first failure: later migrations depend on earlier ones, so
    // carrying on would produce a cascade of errors that hides the real cause.
    break;
  }
}

if (DRY) Deno.exit(0);

console.log(`\napplied ${applied}, failed ${failed}`);

if (failed === 0) {
  // Tell the CLI these are applied, so a later `db push` does not replay them.
  const versions = files
    .map((name) => name.split("_")[0])
    .filter((version) => /^\d{14}$/.test(version));
  if (versions.length) {
    const record = await sql(`
      do $$
      begin
        if exists (
          select 1 from information_schema.tables
          where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
        ) then
          insert into supabase_migrations.schema_migrations (version)
          values ${versions.map((v) => `('${v}')`).join(", ")}
          on conflict (version) do nothing;
        end if;
      end $$;
    `);
    console.log(record.ok
      ? `recorded ${versions.length} versions in supabase_migrations.schema_migrations`
      : `could not record versions: ${record.error}`);
  }

  const after = await sql(
    "select table_name from information_schema.tables where table_schema='public' order by 1",
  );
  const now = (after.rows ?? []).map((r) => (r as { table_name: string }).table_name);
  const added = now.filter((t) => !existing.includes(t));
  console.log(`\npublic now has ${now.length} tables; this run added ${added.length}:`);
  console.log(`  ${added.join(", ")}`);
}

Deno.exitCode = failed === 0 ? 0 : 1;
