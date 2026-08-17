/**
 * scripts/check-share.ts
 * ---------------------------------------------------------------------------
 * A share link is the one part of this app that strangers see, so the claims
 * are checked against the real endpoint and the real public URL:
 *
 *   - the published URL actually serves the page, to a client with no token
 *   - the attribution badge is in what is served, not just in what was sent
 *   - one user cannot publish from another user's project
 *   - a revoked link stops being served
 *   - a code that is not a code is refused before it becomes a Storage path
 *
 * The ownership check asserts on error.code, not on the status. A missing route
 * answers a bare 404 too, and that has already once looked exactly like a
 * refusal — it is not one.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-share.ts
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

/** What the preview would hand us: one self-contained document. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Shared check ${stamp}</title></head>
<body><h1 id="headline">Hello from ${stamp}</h1></body></html>`;

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function makeUser(tag: string) {
  const email = `share-${tag}-${stamp}@example.com`;
  const password = `Sh-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token };
}

async function makeProject(userId: string, tag: string) {
  // sandbox_path is validated against users/<uid>/projects/<pid>, so the row is
  // inserted first and then given its real path.
  const { data, error } = await admin
    .from("projects")
    .insert({ user_id: userId, name: `share-${tag}-${stamp}`, sandbox_path: "pending" })
    .select()
    .single();
  if (error) throw error;
  const id = String(data.id);
  await admin.from("projects").update({ sandbox_path: `users/${userId}/projects/${id}` }).eq("id", id);
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", id); });
  return id;
}

try {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  const ownerProject = await makeProject(owner.id, "own");

  const call = (token: string | null, body: unknown) =>
    fetch(`${API_URL}/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  // ── The route exists at all. Proven before anything else, because every
  //    "refused" assertion below is worthless if a bare 404 is answering.
  const routed = await call(owner.token, { action: "list" });
  const routedBody = await routed.json().catch(() => ({}));
  const isRouted = routed.status !== 404 || typeof routedBody?.error?.code === "string";
  check(`the share route is reachable (got ${routed.status})`, isRouted, routedBody);
  if (!isRouted) throw new Error("share is not routed; the rest of this script would prove nothing.");

  const notMigrated = routedBody?.error?.code === "SHARING_NOT_MIGRATED";
  if (notMigrated) {
    console.log("\n      shares table is missing — run `npx supabase db push`.");
    console.log("      Checks below that need the table are reported as SKIP.\n");
  }

  const skip = (label: string) => console.log(`SKIP  ${label} (needs the migration)`);

  // ── No token, no publishing.
  //
  // LOCAL_DEV_BYPASS answers a token-less request as the first registered user
  // instead of refusing it, so the 401 itself is only assertable with the
  // bypass off. What can be checked either way is that the call fails.
  const bypass = Deno.env.get("LOCAL_DEV_BYPASS") === "true";
  const anonymous = await call(null, { action: "create", projectId: ownerProject, html: PAGE });
  const anonymousBody = await anonymous.json().catch(() => ({}));
  check(
    `publishing without a token fails (got ${anonymous.status} ${anonymousBody?.error?.code})` +
      (bypass ? " [LOCAL_DEV_BYPASS on: 401 not assertable here]" : ""),
    bypass ? !anonymous.ok : anonymous.status === 401,
    anonymousBody,
  );

  // ── A code from a client becomes a Storage path segment.
  for (const bad of ["../../secret", "ABCDEFGHJ", "0000000oo", "x"]) {
    const res = await call(owner.token, { action: "revoke", code: bad });
    const body = await res.json().catch(() => ({}));
    // Either gate is fine — the schema's length bound catches the short ones,
    // the alphabet check catches the rest. What matters is that neither
    // reaches Storage as a path segment.
    const refused = res.status === 400 &&
      (body?.error?.code === "INVALID_SHARE_CODE" || body?.error?.code === "VALIDATION_ERROR");
    check(`revoke refuses "${bad}" (got ${res.status} ${body?.error?.code})`, refused, body);
  }

  // ── Publishing from someone else's project.
  const trespass = await call(stranger.token, { action: "create", projectId: ownerProject, html: PAGE });
  const trespassBody = await trespass.json().catch(() => ({}));
  check(
    `a stranger cannot publish from another user's project (${trespass.status} ${trespassBody?.error?.code})`,
    typeof trespassBody?.error?.code === "string" && trespassBody.error.code !== "SHARE_UPLOAD_FAILED" &&
      trespass.status >= 400 && trespass.status < 500,
    trespassBody,
  );

  // ── The real thing.
  if (notMigrated) {
    skip("a published link serves the page to a stranger");
    skip("the attribution badge is in what is served");
    skip("a revoked link stops being served");
    skip("the owner sees the share in their list");
  } else {
    const created = await call(owner.token, {
      action: "create", projectId: ownerProject, html: PAGE, title: `Check ${stamp}`,
    });
    const createdBody = await created.json().catch(() => ({}));
    check(`publishing succeeds (got ${created.status})`, created.status === 201, createdBody);

    const code = String(createdBody?.code ?? "");
    const url = String(createdBody?.url ?? "");
    if (code) cleanup.push(async () => { await admin.from("shares").delete().eq("code", code); });

    // The point of the whole feature: a client with no token, no key, no
    // relationship to this app can open that URL and get the page.
    const publicFetch = await fetch(url, { headers: { "cache-control": "no-cache" } });
    const served = await publicFetch.text().catch(() => "");
    check(`the URL serves to a client with no credentials (got ${publicFetch.status})`, publicFetch.ok, {
      url,
      body: served.slice(0, 200),
    });
    check("what is served is the page that was sent", served.includes(`Hello from ${stamp}`));
    check("the attribution badge is in what is served", served.includes("Built with Retro Code"));
    check(
      `it is served as html (got ${publicFetch.headers.get("content-type")})`,
      (publicFetch.headers.get("content-type") ?? "").includes("text/html"),
    );

    // The list is how the UI offers "copy link" and "take down" later.
    const listed = await call(owner.token, { action: "list" });
    const listedBody = await listed.json().catch(() => ({}));
    const mine = (listedBody?.shares ?? []).find((row: { code?: string }) => row.code === code);
    check("the owner sees the share in their list", !!mine && mine.url === url, listedBody);

    const strangerList = await call(stranger.token, { action: "list" });
    const strangerBody = await strangerList.json().catch(() => ({}));
    check(
      "a stranger's list does not contain it",
      !(strangerBody?.shares ?? []).some((row: { code?: string }) => row.code === code),
      strangerBody,
    );

    // A stranger must not be able to take down someone else's link.
    const strangerRevoke = await call(stranger.token, { action: "revoke", code });
    const strangerRevokeBody = await strangerRevoke.json().catch(() => ({}));
    check(
      `a stranger cannot revoke it (${strangerRevoke.status} ${strangerRevokeBody?.error?.code})`,
      strangerRevokeBody?.error?.code === "SHARE_NOT_FOUND",
      strangerRevokeBody,
    );

    const revoked = await call(owner.token, { action: "revoke", code });
    const revokedBody = await revoked.json().catch(() => ({}));
    check(`the owner can revoke it (got ${revoked.status})`, revoked.status === 200, revokedBody);

    // The object is gone from Storage; the CDN may still answer for
    // cacheControl seconds, which is why the endpoint reports that number
    // instead of promising an instant takedown. Ask the origin.
    const afterRevoke = await fetch(`${url}?t=${crypto.randomUUID()}`);
    check(`the page stops being served (got ${afterRevoke.status})`, afterRevoke.status === 404, {
      status: afterRevoke.status,
      cacheSeconds: revokedBody?.cacheSeconds,
    });

    const { data: row } = await admin.from("shares").select("revoked_at").eq("code", code).maybeSingle();
    check("the row is kept so the code is never reissued", !!row && !!row.revoked_at, row);

    // Publishing something too large must be refused with a size, not a stack.
    const huge = await call(owner.token, {
      action: "create", projectId: ownerProject, html: "x".repeat(2_100_000),
    });
    const hugeBody = await huge.json().catch(() => ({}));
    check(
      `an oversized page is refused (${huge.status} ${hugeBody?.error?.code})`,
      huge.status === 400 && /KB/.test(String(hugeBody?.error?.message ?? "")),
      hugeBody,
    );
  }
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await step().catch(() => {});
}
