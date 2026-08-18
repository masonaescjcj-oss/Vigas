/**
 * scripts/check-admin.ts
 * ---------------------------------------------------------------------------
 * The admin panel is the largest feature in the app and had no verification at
 * all. It also holds the platform's own API keys, which makes its gate the most
 * consequential authorization check in the codebase:
 *
 *   - a signed-in non-admin is refused, and refused as a 404 rather than a 403,
 *     so the route does not announce itself to someone probing for it
 *   - the ciphertext of a pooled key never leaves the server
 *   - only the flag in the database opens it — there is deliberately no endpoint
 *     that grants admin, so this script sets the flag itself with the service key
 *     and takes it away again
 *   - every tab's actions work: the key pool, the model list, the plans, the
 *     overview
 *
 * Until the admin migration is applied this reports the honest 503 and SKIPs the
 * interior, exactly like the panel itself does.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-admin.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? "http://localhost:54321/functions/v1";

const REAL_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const REAL_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const REAL_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function makeUser(tag: string) {
  const email = `adm-${tag}-${stamp}@example.com`;
  const password = `Ad-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token, client: anon };
}

try {
  const operator = await makeUser("operator");
  const ordinary = await makeUser("ordinary");

  const call = (jwt: string | null, body: unknown) =>
    fetch(`${API_URL}/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    });

  // ── The route exists. Every refusal below means nothing otherwise, and a
  //    missing route answers a bare 404 that looks exactly like the deliberate one.
  const routed = await call(operator.token, { action: "overview" });
  const routedBody = await routed.json().catch(() => ({}));
  const isRouted = routed.status !== 404 || typeof routedBody?.error?.code === "string";
  check(`the admin route is reachable (got ${routed.status})`, isRouted, routedBody);
  if (!isRouted) throw new Error("admin is not routed; nothing below would prove anything.");

  const skip = (label: string) => console.log(`SKIP  ${label}`);

  const notMigrated = routedBody?.error?.code === "ADMIN_NOT_MIGRATED";
  if (notMigrated) {
    console.log("\n      profiles.is_admin is missing — apply 20260816120000_admin_and_key_pool.sql.");
    console.log("      The gate is checked below; the interior is reported as SKIP.\n");
  }
  // ── No token at all.
  //
  //    Two traps here, both of which I first wrote as passing assertions that
  //    proved nothing. The migration error is raised *before* either check being
  //    claimed, so a 503 must not be accepted as evidence of a refusal — and
  //    LOCAL_DEV_BYPASS answers a token-less request as the first registered user,
  //    so the 401 is not observable at all with it on.
  const bypass = Deno.env.get("LOCAL_DEV_BYPASS") === "true";
  const anonymous = await call(null, { action: "overview" });
  if (notMigrated) {
    skip(`an anonymous caller is refused (got ${anonymous.status}, which is the migration error)`);
  } else if (bypass) {
    console.log(`SKIP  an anonymous caller is refused (LOCAL_DEV_BYPASS answers as a real user; got ${anonymous.status})`);
  } else {
    check(`an anonymous caller is refused (${anonymous.status})`, anonymous.status === 401);
  }

  // ── A nonsense action must not reach the gate's far side. Schema validation
  //    happens after the gate, so this is only observable once migrated.
  const badAction = await call(operator.token, { action: "keys.nuke" });
  if (notMigrated) {
    skip(`an unknown action is refused (got ${badAction.status}, which is the migration error)`);
  } else {
    check(`an unknown action is refused (${badAction.status})`, badAction.status === 400, badAction.status);
  }

  if (notMigrated) {
    skip("a signed-in non-admin is refused with 404, not 403 (needs the migration)");
    skip("the flag in the database is what opens the panel (needs the migration)");
    skip("the key pool can be listed, added to, updated and emptied (needs the migration)");
    skip("a pooled key's ciphertext never leaves the server (needs the migration)");
    skip("models and plans can be edited (needs the migration)");
    skip("the overview reports counts (needs the migration)");
  } else {
    // ── An ordinary signed-in user.
    const refused = await call(ordinary.token, { action: "keys.list" });
    const refusedBody = await refused.json().catch(() => ({}));
    check(
      `a signed-in non-admin is refused (${refused.status} ${refusedBody?.error?.code})`,
      refused.status === 404,
      refusedBody,
    );
    check(
      "...as a 404, so the route does not announce itself to a prober",
      refused.status !== 403,
      refusedBody,
    );

    // ── The flag is the only thing that opens it.
    const beforeFlag = await call(operator.token, { action: "keys.list" });
    check(`without the flag the operator is refused too (${beforeFlag.status})`, beforeFlag.status === 404);

    const { error: flagError } = await admin
      .from("profiles").update({ is_admin: true }).eq("id", operator.id);
    check("the flag can be set in SQL, which is the only way in", !flagError, flagError);
    cleanup.push(async () => {
      await admin.from("profiles").update({ is_admin: false }).eq("id", operator.id);
    });

    const afterFlag = await call(operator.token, { action: "keys.list" });
    const afterBody = await afterFlag.json().catch(() => ({}));
    check(`with the flag the panel opens (${afterFlag.status})`, afterFlag.status === 200, afterBody);
    check("the key list is an array", Array.isArray(afterBody?.keys), afterBody);

    // ── The key pool. Uses the real provider so the probe means something.
    if (!REAL_KEY) {
      console.log("SKIP  adding a pooled key (OPENAI_API_KEY is not set)");
    } else {
      const added = await call(operator.token, {
        action: "keys.add",
        label: `pool-${stamp}`,
        baseUrl: REAL_BASE_URL,
        apiKey: REAL_KEY,
        model: REAL_MODEL,
        priority: 50,
      });
      const addedBody = await added.json().catch(() => ({}));
      check(`a working key is accepted and probed (${added.status})`, added.status === 201, addedBody);
      check("the probe reports success for a real key", addedBody?.verified === true, addedBody);

      const keyId = addedBody?.key?.id;
      if (keyId) {
        cleanup.push(async () => { await admin.from("platform_providers").delete().eq("id", keyId); });

        // The whole point of storing ciphertext: it must never come back out.
        const listed = await call(operator.token, { action: "keys.list" });
        const listedText = await listed.text();
        check("no response contains the key itself", !listedText.includes(REAL_KEY), listedText.slice(0, 200));
        check("nor its ciphertext column", !/key_cipher/.test(listedText), listedText.slice(0, 200));
        check("but the last four are shown, so two keys can be told apart",
          listedText.includes(REAL_KEY.slice(-4)), listedText.slice(0, 200));

        // Even the operator's own JWT must not read the table directly.
        const direct = await operator.client.from("platform_providers").select("key_cipher").limit(1);
        check(`a direct read of the pool is refused (${direct.error?.code ?? "no error!"})`, !!direct.error, direct.error);

        const renamed = await call(operator.token, {
          action: "keys.update", id: keyId, label: `renamed-${stamp}`, priority: 10,
        });
        check(`a key can be renamed and reprioritised (${renamed.status})`, renamed.status === 200);

        const tested = await call(operator.token, { action: "keys.test", id: keyId });
        const testedBody = await tested.json().catch(() => ({}));
        check(`the test button reports a real result (${tested.status})`, tested.status === 200, testedBody);
        check("and says the key works", testedBody?.result?.ok === true, testedBody);

        // A non-admin must not be able to touch it even knowing the id.
        const trespass = await call(ordinary.token, { action: "keys.delete", id: keyId });
        check(`a non-admin cannot delete a pooled key (${trespass.status})`, trespass.status === 404);
        const { count: still } = await admin
          .from("platform_providers").select("id", { count: "exact", head: true }).eq("id", keyId);
        check("...and it is still there", (still ?? 0) === 1);

        const removed = await call(operator.token, { action: "keys.delete", id: keyId });
        check(`the operator can delete it (${removed.status})`, removed.status === 200);
      }
    }

    // ── Models: what users are offered.
    const modelId = `check-model-${stamp}`;
    const upserted = await call(operator.token, {
      action: "models.upsert", modelId, displayName: "Check Model", sortOrder: 99,
    });
    const upsertedBody = await upserted.json().catch(() => ({}));
    check(`a model can be added (${upserted.status})`, upserted.status === 200, upsertedBody);
    cleanup.push(async () => { await admin.from("models").delete().eq("id", modelId); });

    // The app reads this table with the anon key, so a new model must be visible
    // to a signed-in user — that is the whole point of editing it here.
    const visible = await ordinary.client.from("models").select("id").eq("id", modelId).maybeSingle();
    check("a user can see the model the operator added", visible.data?.id === modelId, visible);

    const madeDefault = await call(operator.token, {
      action: "models.upsert", modelId, displayName: "Check Model", isDefault: true,
    });
    check(`a model can be made the default (${madeDefault.status})`, madeDefault.status === 200);
    const { count: defaults } = await admin
      .from("models").select("id", { count: "exact", head: true }).eq("is_default", true);
    check(`exactly one model is default (found ${defaults})`, defaults === 1);

    const deletedModel = await call(operator.token, { action: "models.delete", modelId });
    check(`a model can be removed (${deletedModel.status})`, deletedModel.status === 200);

    // ── Plans: the limits behind each tier.
    const plans = await call(operator.token, { action: "plans.list" });
    const plansBody = await plans.json().catch(() => ({}));
    check(`plans can be listed (${plans.status})`, plans.status === 200, plansBody);
    check("the four tiers seeded by the migration are there",
      (plansBody?.plans ?? []).length >= 4, plansBody?.plans?.map((p: any) => p.key));

    const { data: freeBefore } = await admin
      .from("plans").select("build_runs_per_day").eq("key", "free").maybeSingle();
    const updatedPlan = await call(operator.token, {
      action: "plans.update", planKey: "free", buildRunsPerDay: 7,
    });
    check(`a plan limit can be changed (${updatedPlan.status})`, updatedPlan.status === 200);
    const { data: freeAfter } = await admin
      .from("plans").select("build_runs_per_day").eq("key", "free").maybeSingle();
    check(`the change is stored (${freeBefore?.build_runs_per_day} -> ${freeAfter?.build_runs_per_day})`,
      freeAfter?.build_runs_per_day === 7);
    // Put it back: this is the live limit for every free user.
    cleanup.push(async () => {
      await admin.from("plans")
        .update({ build_runs_per_day: freeBefore?.build_runs_per_day ?? 4 }).eq("key", "free");
    });

    const nonPlan = await call(operator.token, { action: "plans.update", planKey: "nope", buildRunsPerDay: 1 });
    check(`updating a plan that does not exist is refused (${nonPlan.status})`, nonPlan.status >= 400);

    // ── Overview.
    const overview = await call(operator.token, { action: "overview" });
    const overviewBody = await overview.json().catch(() => ({}));
    check(`the overview loads (${overview.status})`, overview.status === 200, overviewBody);
    check("it reports something countable rather than an empty object",
      Object.keys(overviewBody ?? {}).length > 0, overviewBody);

    // ── Taking the flag away closes the panel again.
    await admin.from("profiles").update({ is_admin: false }).eq("id", operator.id);
    const closed = await call(operator.token, { action: "keys.list" });
    check(`clearing the flag closes the panel (${closed.status})`, closed.status === 404);
  }
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await step().catch(() => {});
}
