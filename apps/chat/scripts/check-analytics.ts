/**
 * scripts/check-analytics.ts
 * ---------------------------------------------------------------------------
 * Can a user write their own events, and can they read anyone's?
 *
 * The table records how people use the product, which makes it the one place a
 * signed-in stranger could learn about other users if the policies are wrong.
 * Insert-only for `authenticated` is the whole design, and RLS is not something
 * to take on trust — a missing policy fails open in exactly the way that is
 * invisible until it matters.
 *
 *   PROVIDER_API_URL=http://localhost:54321/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-analytics.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300)}`),
  );
  if (!ok) Deno.exitCode = 1;
}

try {
  // Two accounts: one writes, the other tries to read what the first wrote.
  const accounts: Record<string, { id: string; client: ReturnType<typeof createClient> }> = {};
  for (const who of ["alice", "mallory"]) {
    const email = `analytics-${who}-${stamp}@example.com`;
    const password = `An-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));

    const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    accounts[who] = { id: data.user!.id, client };
  }

  // ── Writing your own event.
  const own = await accounts.alice.client.from("analytics_events").insert({
    user_id: accounts.alice.id,
    event: "build_started",
    properties: { model: "auto" },
    platform: "web",
  });
  check(`a user can record their own event (${own.error?.code ?? "ok"})`, !own.error, own.error);

  // ── Writing an event attributed to somebody else.
  const forged = await accounts.mallory.client.from("analytics_events").insert({
    user_id: accounts.alice.id,
    event: "checkout_started",
    properties: { plan: "pro_yearly" },
    platform: "web",
  });
  check(
    `a user cannot record an event as someone else (${forged.error?.code ?? "ACCEPTED"})`,
    !!forged.error,
    forged.error ?? "the insert was accepted",
  );

  // ── Reading. This is the one that matters.
  const read = await accounts.mallory.client
    .from("analytics_events").select("event,user_id").limit(10);
  check(
    `a signed-in user cannot read the table (${read.error?.code ?? `${read.data?.length ?? 0} rows`})`,
    !!read.error || (read.data?.length ?? 0) === 0,
    read.data,
  );

  // Not even their own — there is no select policy at all, on purpose.
  const readOwn = await accounts.alice.client
    .from("analytics_events").select("event").eq("user_id", accounts.alice.id).limit(10);
  check(
    `not even their own events (${readOwn.error?.code ?? `${readOwn.data?.length ?? 0} rows`})`,
    !!readOwn.error || (readOwn.data?.length ?? 0) === 0,
    readOwn.data,
  );

  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const anonRead = await anon.from("analytics_events").select("event").limit(10);
  check(
    `a signed-out visitor cannot read it either (${anonRead.error?.code ?? `${anonRead.data?.length ?? 0} rows`})`,
    !!anonRead.error || (anonRead.data?.length ?? 0) === 0,
    anonRead.data,
  );

  // ── Updating or deleting: an event is written once and is not the writer's
  //    to revise. Someone who could delete their own could hide a funnel.
  const update = await accounts.alice.client
    .from("analytics_events").update({ event: "signed_up" }).eq("user_id", accounts.alice.id);
  check(`a user cannot rewrite an event (${update.error?.code ?? "ACCEPTED"})`, !!update.error, update.error);

  const remove = await accounts.alice.client
    .from("analytics_events").delete().eq("user_id", accounts.alice.id);
  check(`a user cannot delete their events (${remove.error?.code ?? "ACCEPTED"})`, !!remove.error, remove.error);

  // ── The operator can read, or the whole feature is pointless.
  const { data: adminRead, error: adminError } = await admin
    .from("analytics_events").select("event,user_id,properties").eq("user_id", accounts.alice.id);
  check(
    `the service role can read it (${adminRead?.length ?? 0} rows)`,
    !adminError && (adminRead?.length ?? 0) >= 1,
    adminError ?? adminRead,
  );
  check(
    "the recorded event kept only its allow-listed property",
    JSON.stringify(adminRead?.[0]?.properties) === JSON.stringify({ model: "auto" }),
    adminRead?.[0]?.properties,
  );

  cleanup.push(async () => {
    await admin.from("analytics_events").delete().eq("user_id", accounts.alice.id);
  });
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await Promise.resolve(step()).catch(() => {});
}
