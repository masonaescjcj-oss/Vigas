/**
 * scripts/check-push.ts
 * ---------------------------------------------------------------------------
 * A push token addresses someone's phone, so the things worth checking are the
 * ones that would let it address the wrong one:
 *
 *   - a token is written only through the function, never by the client
 *   - the token is never returned to a client, not even its owner's
 *   - one user cannot unregister another user's device
 *   - a device that changes hands moves rather than duplicating
 *   - a junk token is refused before it reaches the database
 *
 * Assertions are on error.code, not on the status: a missing route answers a
 * bare 404 that reads exactly like a refusal.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-push.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function token(tag: string): string {
  return `ExponentPushToken[${tag}${stamp}xxxxxxxx]`;
}

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function makeUser(tag: string) {
  const email = `push-${tag}-${stamp}@example.com`;
  const password = `Pu-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token, client: anon };
}

try {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");

  const call = (jwt: string | null, body: unknown) =>
    fetch(`${API_URL}/push-register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    });

  // ── The route exists. Every "refused" below is meaningless otherwise.
  const routed = await call(owner.token, { action: "list" });
  const routedBody = await routed.json().catch(() => ({}));
  const isRouted = routed.status !== 404 || typeof routedBody?.error?.code === "string";
  check(`the push-register route is reachable (got ${routed.status})`, isRouted, routedBody);
  if (!isRouted) throw new Error("push-register is not routed; the rest would prove nothing.");

  const notMigrated = routedBody?.error?.code === "PUSH_NOT_MIGRATED";
  if (notMigrated) {
    console.log("\n      push_tokens table is missing — run `npx supabase db push`.");
    console.log("      Checks below that need the table are reported as SKIP.\n");
  }
  const skip = (label: string) => console.log(`SKIP  ${label} (needs the migration)`);

  // ── A junk token must not reach the database. Checked before the migration
  //    gate, because this refusal happens in the function.
  for (const bad of ["not-a-token-at-all", "ExponentPushToken[]", "fcm:AAAA123456789012"]) {
    const res = await call(owner.token, { action: "register", token: bad, platform: "android" });
    const body = await res.json().catch(() => ({}));
    const refused = res.status === 400 &&
      (body?.error?.code === "INVALID_PUSH_TOKEN" || body?.error?.code === "VALIDATION_ERROR");
    check(`"${bad.slice(0, 24)}" is refused (${res.status} ${body?.error?.code})`, refused, body);
  }

  // ── An unknown platform is not silently coerced to android.
  const badPlatform = await call(owner.token, {
    action: "register", token: token("plat"), platform: "windows",
  });
  const badPlatformBody = await badPlatform.json().catch(() => ({}));
  check(
    `an unknown platform is refused (${badPlatform.status} ${badPlatformBody?.error?.code})`,
    badPlatform.status === 400,
    badPlatformBody,
  );

  // ── The client must never be able to write this table itself, migration or
  //    not: if the table exists, RLS has to refuse an insert with a real JWT.
  if (notMigrated) {
    skip("a client with a valid token cannot insert a row directly");
    skip("registering stores the device");
    skip("list never returns the token itself");
    skip("a stranger cannot unregister someone else's device");
    skip("a device that changes hands moves rather than duplicating");
  } else {
    const direct = await owner.client.from("push_tokens").insert({
      user_id: owner.id, token: token("direct"), platform: "android",
    });
    check(
      `a client cannot insert a row directly (${direct.error?.code ?? "no error!"})`,
      !!direct.error,
      direct.error,
    );

    const ownerToken = token("own");
    const registered = await call(owner.token, {
      action: "register", token: ownerToken, platform: "android", deviceName: "Pixel Test",
    });
    check(`registering succeeds (got ${registered.status})`, registered.status === 200,
      await registered.json().catch(() => ({})));
    cleanup.push(async () => { await admin.from("push_tokens").delete().eq("token", ownerToken); });

    const { data: row } = await admin
      .from("push_tokens").select("user_id,platform,device_name,disabled_at").eq("token", ownerToken).maybeSingle();
    check("the row belongs to the caller and is active",
      row?.user_id === owner.id && row?.platform === "android" && row?.disabled_at === null, row);

    // The token identifies a device; nothing in the app needs to read one back.
    const listed = await call(owner.token, { action: "list" });
    const listedBody = await listed.json().catch(() => ({}));
    const devices = listedBody?.devices ?? [];
    check("the owner sees their device", devices.length === 1 && devices[0].device_name === "Pixel Test", listedBody);
    check("list never returns the token itself",
      !JSON.stringify(listedBody).includes(ownerToken), listedBody);

    // Even reading the table with the owner's own JWT must not expose it.
    const readBack = await owner.client.from("push_tokens").select("*").eq("token", ownerToken);
    check(
      "a direct select does not expose the token column value to the owner either",
      !JSON.stringify(readBack.data ?? []).includes(ownerToken),
      readBack.data,
    );

    // ── A stranger deleting someone else's device.
    const strangerRemove = await call(stranger.token, { action: "unregister", token: ownerToken });
    check(`a stranger's unregister returns ok (got ${strangerRemove.status})`, strangerRemove.status === 200);
    const { data: stillThere } = await admin
      .from("push_tokens").select("user_id").eq("token", ownerToken).maybeSingle();
    check("...but the device is still registered to its owner", stillThere?.user_id === owner.id, stillThere);

    // ── A phone that changes hands. The token is unique, so this must move the
    //    row, not create a second one — otherwise the previous owner keeps
    //    getting notifications on a phone they no longer hold.
    const moved = await call(stranger.token, {
      action: "register", token: ownerToken, platform: "android", deviceName: "Same Phone",
    });
    check(`re-registering an existing token succeeds (got ${moved.status})`, moved.status === 200,
      await moved.json().catch(() => ({})));
    const { data: after, count } = await admin
      .from("push_tokens").select("user_id", { count: "exact" }).eq("token", ownerToken);
    check(`the device moved rather than duplicating (rows=${count})`,
      count === 1 && after?.[0]?.user_id === stranger.id, after);

    const ownerNow = await call(owner.token, { action: "list" });
    const ownerNowBody = await ownerNow.json().catch(() => ({}));
    check("the previous owner no longer sees it", (ownerNowBody?.devices ?? []).length === 0, ownerNowBody);
  }
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await step().catch(() => {});
}
