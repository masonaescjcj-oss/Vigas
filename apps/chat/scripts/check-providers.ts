/**
 * scripts/check-providers.ts
 * ---------------------------------------------------------------------------
 * Bring-your-own-key holds other people's payment credentials, so the claims
 * the UI makes about it are checked against the real database and the real
 * endpoint rather than assumed:
 *
 *   - the key is stored encrypted, and the plaintext appears in no column
 *   - the client cannot read the ciphertext even with its own valid token
 *   - a key the provider rejects is never stored at all
 *   - an endpoint that is not a public API is refused
 *   - one user cannot see or delete another's provider
 *
 * Uses the real model provider from .env as the "user's own" provider, since
 * that is a genuine OpenAI-compatible endpoint that will answer.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-providers.ts
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
  const email = `prov-${tag}-${stamp}@example.com`;
  const password = `Pv-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token };
}

try {
  if (!REAL_KEY) throw new Error("OPENAI_API_KEY is not set; this check needs a real provider to call.");

  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");

  const call = (token: string, body: unknown) =>
    fetch(`${API_URL}/provider-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // An endpoint that is not a public API is refused before anything is stored.
  for (const [name, url] of [
    ["cloud metadata", "https://169.254.169.254/v1"],
    ["loopback", "https://127.0.0.1/v1"],
    ["private range", "https://10.1.2.3/v1"],
    ["plaintext http", "http://api.openai.com/v1"],
  ] as const) {
    const res = await call(owner.token, {
      action: "add", label: `bad-${name}`, baseUrl: url, apiKey: "sk-whatever-1234",
    });
    const body = await res.json().catch(() => ({}));
    check(`${name} is refused (got ${res.status})`, res.status === 400 && body?.error?.code === "INVALID_PROVIDER_URL", body);
  }

  // A key the provider rejects must not be stored.
  const badKey = await call(owner.token, {
    action: "add", label: "wrong key", baseUrl: REAL_BASE_URL, apiKey: "sk-definitely-not-valid-000",
  });
  const badBody = await badKey.json().catch(() => ({}));
  check(`a rejected key is refused (got ${badKey.status})`, badKey.status === 400, badBody);
  const { count: afterBad } = await admin
    .from("user_providers").select("id", { count: "exact", head: true }).eq("user_id", owner.id);
  check(`nothing was stored for it (rows=${afterBad})`, (afterBad ?? 0) === 0);

  // The real thing.
  const added = await call(owner.token, {
    action: "add", label: "My provider", baseUrl: REAL_BASE_URL, apiKey: REAL_KEY, model: REAL_MODEL,
  });
  const addedBody = await added.json().catch(() => ({}));
  check(`a working provider is accepted (got ${added.status})`, added.status === 201, addedBody);
  if (added.status !== 201) throw new Error("cannot continue without a stored provider");

  const providerId = addedBody.provider.id;
  check("the response carries no key", JSON.stringify(addedBody).includes(REAL_KEY) === false);
  check("it shows the last four characters", addedBody.provider.key_last4 === REAL_KEY.slice(-4), addedBody.provider);
  check("it is marked verified", !!addedBody.provider.verified_at, addedBody.provider);

  // The stored row must not contain the key in any column.
  const { data: row } = await admin.from("user_providers").select("*").eq("id", providerId).maybeSingle();
  const serialised = JSON.stringify(row);
  check("the plaintext key is in no column", serialised.includes(REAL_KEY) === false);
  check("a ciphertext is stored", typeof row?.key_cipher === "string" && row.key_cipher.length > 20);

  // The owner's own token must not be able to read the ciphertext.
  const asOwner = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${owner.token}` } },
  });
  const cipherRead = await asOwner.from("user_providers").select("key_cipher").eq("id", providerId);
  check("the client cannot select the ciphertext", !!cipherRead.error, cipherRead.data);

  const safeRead = await asOwner.from("user_providers").select("id,label,key_last4").eq("id", providerId);
  check("the client can still read the safe columns", !safeRead.error && safeRead.data?.length === 1, safeRead.error);

  // List returns no key.
  const listed = await (await call(owner.token, { action: "list" })).json();
  check("list returns the provider without a key", JSON.stringify(listed).includes(REAL_KEY) === false, null);
  check(`list returns exactly one (got ${listed.providers?.length})`, listed.providers?.length === 1);

  // Test re-verifies against the live provider.
  const tested = await (await call(owner.token, { action: "test", id: providerId })).json();
  check("test reports the provider works", tested.ok === true, tested);

  // Another user must not see or delete it.
  const strangerList = await (await call(stranger.token, { action: "list" })).json();
  check(`a stranger sees none of it (got ${strangerList.providers?.length})`, (strangerList.providers?.length ?? 0) === 0);
  await call(stranger.token, { action: "delete", id: providerId });
  const { count: stillThere } = await admin
    .from("user_providers").select("id", { count: "exact", head: true }).eq("id", providerId);
  check("a stranger cannot delete it", (stillThere ?? 0) === 1);

  // The agent actually uses it: ask a question and confirm which provider answered.
  const ask = await fetch(`${API_URL}/agent-ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${owner.token}` },
    body: JSON.stringify({ prompt: "Reply with just: ok" }),
  });
  const askBody = await ask.json().catch(() => ({}));
  check(`a question succeeds (got ${ask.status})`, ask.status === 200, askBody);
  check("it reports answering through the user's provider", askBody.provider === "My provider", askBody);

  // Removing it is allowed for the owner.
  const removed = await call(owner.token, { action: "delete", id: providerId });
  check(`the owner can remove it (got ${removed.status})`, removed.status === 200, await removed.text());
  const { count: afterDelete } = await admin
    .from("user_providers").select("id", { count: "exact", head: true }).eq("id", providerId);
  check(`the row is gone (rows=${afterDelete})`, (afterDelete ?? 0) === 0);
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
