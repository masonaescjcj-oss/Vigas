/**
 * scripts/check-model-tiers.ts
 * ---------------------------------------------------------------------------
 * Does marking a model "premium" in the admin panel actually stop a free
 * account using it?
 *
 * It did not, and nothing noticed: `min_tier` was stored on the models row and
 * editable in the admin UI, while the server decided from an ALLOWED_MODELS
 * environment variable that knew nothing about the catalogue. A free account
 * could name the premium model and be served it. That is a paid feature given
 * away, so it gets a check that talks to the real backend.
 *
 *   PROVIDER_API_URL=http://localhost:54321/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-model-tiers.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

/** The model this check gates and then restores. */
const GATED = "deepseek-reasoner";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`),
  );
  if (!ok) Deno.exitCode = 1;
}

try {
  // ── Remember how the catalogue was, so this check leaves no trace.
  const { data: before } = await admin
    .from("models").select("id,min_tier,is_active").eq("id", GATED).maybeSingle();
  if (!before) throw new Error(`${GATED} is not in the models table; nothing to gate.`);
  cleanup.push(() =>
    admin.from("models").update({ min_tier: before.min_tier }).eq("id", GATED)
  );

  // ── A free account and a paying one, identical but for the tier.
  const accounts: Record<string, { id: string; token: string }> = {};
  for (const tier of ["free", "pro"]) {
    const email = `tier-${tier}-${stamp}@example.com`;
    const password = `Ti-${crypto.randomUUID()}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    const id = created.user!.id;
    cleanup.push(() => admin.auth.admin.deleteUser(id));
    await admin.from("profiles").update({ subscription_tier: tier }).eq("id", id);

    const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { data: session, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    accounts[tier] = { id, token: session.session!.access_token };
  }

  const call = (token: string, name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // Each account needs a project of its own to run against.
  const projects: Record<string, string> = {};
  for (const tier of ["free", "pro"]) {
    const res = await call(accounts[tier].token, "projects-create", {
      name: `Tier check ${tier} ${stamp}`, template: "landing",
    });
    const body = await res.json().catch(() => ({}));
    const id = body?.project?.id ?? body?.id;
    if (!id) throw new Error(`could not create a project for ${tier}: ${JSON.stringify(body)}`);
    projects[tier] = id;
    cleanup.push(async () => { await admin.from("projects").delete().eq("id", id); });
  }

  const runWith = (tier: string, model: string) =>
    call(accounts[tier].token, "agent-run", {
      projectId: projects[tier], prompt: "Say hello.", model, title: `tier ${stamp}`,
    });

  // ── Ungated: everyone may use it. Establishes that the check itself works.
  await admin.from("models").update({ min_tier: null }).eq("id", GATED);
  const openToFree = await runWith("free", GATED);
  check(
    `while the model is free, a free account may use it (${openToFree.status})`,
    openToFree.status === 202 || openToFree.ok,
    await openToFree.json().catch(() => ({})),
  );

  // ── Now gate it, exactly as the admin panel does.
  await admin.from("models").update({ min_tier: "pro" }).eq("id", GATED);

  const refused = await runWith("free", GATED);
  const refusedBody = await refused.json().catch(() => ({}));
  check(
    `once marked pro, a free account is refused (${refused.status} ${refusedBody?.error?.code})`,
    refused.status === 403 && refusedBody?.error?.code === "MODEL_REQUIRES_UPGRADE",
    refusedBody,
  );
  check(
    "the refusal names the plan, so the app can open the right paywall",
    refusedBody?.error?.details?.requiredTier === "pro",
    refusedBody?.error?.details,
  );

  const allowed = await runWith("pro", GATED);
  check(
    `a pro account may use it (${allowed.status})`,
    allowed.status === 202 || allowed.ok,
    await allowed.json().catch(() => ({})),
  );

  // ── The free account is not locked out of the product, only that model.
  const fallback = await runWith("free", "auto");
  check(
    `the free account can still run on auto (${fallback.status})`,
    fallback.status === 202 || fallback.ok,
    await fallback.json().catch(() => ({})),
  );

  // ── A model must never end up gated on a plan that does not exist: rank it
  //    like an unknown *held* tier and it ties with free, handing the paid model
  //    to everyone. The server ranks an unknown requirement as unreachable, but
  //    the real protection is the foreign key, so that is what is asserted here.
  //
  //    Written the other way round first — gate the model on a made-up plan and
  //    expect a 403 — which passed for the wrong reason: the update was rejected,
  //    min_tier stayed "pro", and the run that came back 202 was correct.
  const orphaned = await admin
    .from("models").update({ min_tier: "retired-plan-that-does-not-exist" }).eq("id", GATED);
  check(
    `the database refuses to gate a model on a plan that does not exist (${orphaned.error?.code})`,
    orphaned.error?.code === "23503",
    orphaned.error ?? "the update was accepted, so a model can be orphaned",
  );

  // And the other route to the same state: deleting a plan out from under a
  // model. NO ACTION rather than SET NULL, or removing the Pro plan would
  // silently make every Pro model free.
  await admin.from("plans").insert({ key: "zz-tier-check", display_name: "Temp", sort_order: 9 });
  cleanup.push(() => admin.from("plans").delete().eq("key", "zz-tier-check"));
  await admin.from("models").update({ min_tier: "zz-tier-check" }).eq("id", GATED);
  const removal = await admin.from("plans").delete().eq("key", "zz-tier-check");
  check(
    `a plan cannot be deleted while a model is gated on it (${removal.error?.code})`,
    removal.error?.code === "23503",
    removal.error ?? "the plan was deleted, so its models may have silently become free",
  );
  // Released here, not in teardown: teardown runs in reverse, so the temp plan
  // would be deleted while the model still pointed at it — the very foreign key
  // just asserted would then block it and leave the plan behind.
  await admin.from("models").update({ min_tier: before.min_tier }).eq("id", GATED);

  // ── And the catalogue is what the app reads, so the two agree.
  const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: visible } = await anonClient.from("models").select("id,min_tier").eq("id", GATED).maybeSingle();
  check(
    "the app can read the same row the server gates on",
    visible?.id === GATED,
    visible,
  );
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  // Promise.resolve because a PostgREST builder is thenable but has no .catch,
  // and one failing teardown must not skip the rest — this leaves rows behind
  // in a real project otherwise.
  for (const step of cleanup.reverse()) {
    await Promise.resolve(step()).catch(() => {});
  }
}
