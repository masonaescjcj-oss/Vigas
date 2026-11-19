/**
 * scripts/check-admin-key-swap.ts
 * ---------------------------------------------------------------------------
 * Can the operator change the API key without anyone noticing?
 *
 * Two halves, and the second is the one that matters:
 *
 *   1. a key added in the panel is what a run actually uses
 *   2. a key that does not work does not take the product down with it
 *
 * The second is the real risk of wiring the panel up at all. Before, the panel
 * was inert and a bad key was harmless; now it decides what every build uses,
 * so a typo could strand every user until somebody noticed. The server's own
 * key has to remain the floor.
 *
 * Runs against the deployed stack with the operator's real key, then removes
 * what it added.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-admin-key-swap.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

/** What a run would resolve to right now, asked the same way the worker asks. */
async function resolvedLabel(): Promise<string | null> {
  const { resolveProvider } = await import("../supabase/functions/shared/resolveProvider.ts");
  const resolved = await resolveProvider(admin, crypto.randomUUID());
  return resolved.label ?? null;
}

try {
  const { data: existing } = await admin.from("platform_providers").select("id");
  check(
    `the pool starts empty (${existing?.length ?? 0} rows)`,
    (existing?.length ?? 0) === 0,
    "this check adds and removes its own rows; leftovers would confuse it",
  );

  check("with an empty pool, a run uses the server's own key", (await resolvedLabel()) === null);

  // ── 1. A working key, added the way the panel adds one.
  const good = {
    label: "check-admin-key-swap (good)",
    base_url: Deno.env.get("OPENAI_BASE_URL")!,
    key_cipher: null as string | null,
    model: Deno.env.get("OPENAI_MODEL") ?? null,
  };
  const { sealSecret } = await import("../supabase/functions/shared/secretBox.ts");
  good.key_cipher = await sealSecret(Deno.env.get("OPENAI_API_KEY")!);

  const { data: goodRow, error: goodErr } = await admin.from("platform_providers").insert({
    label: good.label,
    base_url: good.base_url,
    key_cipher: good.key_cipher,
    key_last4: Deno.env.get("OPENAI_API_KEY")!.slice(-4),
    model: good.model,
    priority: 100,
    is_active: true,
  }).select("id").single();
  if (goodErr) throw goodErr;
  cleanup.push(async () => { await admin.from("platform_providers").delete().eq("id", goodRow.id); });

  check("a key added to the pool is what a run resolves to", (await resolvedLabel()) === good.label);

  // ── 2. The risk: a key that does not work.
  const { data: badRow, error: badErr } = await admin.from("platform_providers").insert({
    label: "check-admin-key-swap (broken)",
    base_url: good.base_url,
    key_cipher: await sealSecret("sk-this-key-does-not-exist"),
    key_last4: "xxxx",
    model: good.model,
    // Lower number runs first, so this one is preferred over the good key —
    // the worst case an operator can create by pasting a typo.
    priority: 1,
    is_active: true,
    exhausted_at: new Date().toISOString(),
    failure_count: 1,
  }).select("id").single();
  if (badErr) throw badErr;
  cleanup.push(async () => { await admin.from("platform_providers").delete().eq("id", badRow.id); });

  check(
    "a broken top-priority key is skipped in favour of the working one",
    (await resolvedLabel()) === good.label,
    "the failed key was chosen anyway",
  );

  // ── And when the broken key is the *only* key.
  await admin.from("platform_providers").delete().eq("id", goodRow.id);
  check(
    "with only a broken key, a run falls back to the server's own",
    (await resolvedLabel()) === null,
    "every user would be stuck behind one bad key",
  );

  // ── Cool-down, not a tombstone: an operator who tops up gets it back.
  await admin.from("platform_providers")
    .update({ exhausted_at: new Date(Date.now() - 24 * 3600_000).toISOString() })
    .eq("id", badRow.id);
  check(
    "a key that has rested is offered again without touching the panel",
    (await resolvedLabel()) === "check-admin-key-swap (broken)",
  );

  // ── Switching it off in the panel is different, and must be respected.
  await admin.from("platform_providers").update({ is_active: false }).eq("id", badRow.id);
  check("a key switched off in the panel is never used", (await resolvedLabel()) === null);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
  const { data: left } = await admin.from("platform_providers").select("id");
  console.log(`\n      pool left with ${left?.length ?? 0} row(s)`);
}
