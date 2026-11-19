/**
 * scripts/bundle-migrations.ts
 * ---------------------------------------------------------------------------
 * Build one SQL file that can be pasted into the Supabase dashboard's SQL
 * Editor.
 *
 * `supabase db push` is the normal route, but it needs `supabase login` (an
 * access token) and `supabase link` (the database password). The dashboard needs
 * neither — the operator is already signed in there. For a project where those
 * credentials are the thing blocking four finished features, that difference
 * matters more than tidiness.
 *
 * Generated rather than hand-written, so it cannot drift from the migrations it
 * claims to contain.
 *
 * The output also records each version in `supabase_migrations.schema_migrations`
 * so a later `db push` does not try to replay them. Every migration here is
 * idempotent, so a replay would be harmless — but "harmless" is not the same as
 * "correct", and a CLI that disagrees with the database about what is applied is
 * how migration state gets confusing.
 *
 *   npx deno run --allow-read --allow-write scripts/bundle-migrations.ts
 * ---------------------------------------------------------------------------
 */

/**
 * In dependency order, which here is also timestamp order: `touch_updated_at()`
 * is created by admin_and_key_pool and used by shared_apps and push_tokens.
 */
const PENDING = [
  "20260816090000_user_providers.sql",
  "20260816120000_admin_and_key_pool.sql",
  "20260816150000_shared_apps.sql",
  "20260817090000_push_tokens.sql",
];

const OUTPUT = "supabase/APPLY_IN_DASHBOARD.sql";

const header = `-- ===========================================================================
-- APPLY_IN_DASHBOARD.sql — GENERATED, do not edit.
--
-- Regenerate with:
--   npx deno run --allow-read --allow-write scripts/bundle-migrations.ts
--
-- HOW TO USE
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   No CLI login, no access token and no database password are needed.
--
-- WHAT IT UNBLOCKS
--   user_providers      bring-your-own API keys
--   plans / models /
--     platform_providers the admin panel and the key pool
--   shares              public share links
--   push_tokens         build-finished notifications
--
-- Every statement is idempotent: running this twice changes nothing the second
-- time. It creates no data beyond the default plan and model rows.
--
-- AFTERWARDS, to open the admin panel for yourself (there is deliberately no
-- endpoint that grants this):
--   update public.profiles set is_admin = true where email = 'YOUR@EMAIL';
-- ===========================================================================

`;

const parts: string[] = [header];

for (const file of PENDING) {
  const sql = await Deno.readTextFile(`supabase/migrations/${file}`);
  parts.push(`
-- ===========================================================================
-- ${file}
-- ===========================================================================

${sql.trim()}
`);
}

// Tell the CLI these are applied. Guarded, because a project that has never had
// a `db push` has no such schema, and a missing table must not fail the whole
// paste after the real work has already succeeded.
const versions = PENDING.map((file) => file.split("_")[0]);
parts.push(`
-- ===========================================================================
-- Record these as applied, so a later \`supabase db push\` does not replay them.
-- ===========================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
  ) then
    insert into supabase_migrations.schema_migrations (version)
    values ${versions.map((version) => `('${version}')`).join(", ")}
    on conflict (version) do nothing;
  end if;
end $$;
`);

await Deno.writeTextFile(OUTPUT, parts.join("\n"));

const bytes = (await Deno.stat(OUTPUT)).size;
console.log(`Wrote ${OUTPUT} (${PENDING.length} migrations, ${Math.round(bytes / 1024)} KB)`);
