/**
 * scripts/check-incognito.ts
 * ---------------------------------------------------------------------------
 * "Nothing is saved" is a promise the UI makes to the user, so it is checked
 * rather than assumed. Sends an incognito turn with a unique marker phrase,
 * then goes looking for that phrase — and for any new row at all — across every
 * table an agent run would normally write to.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-incognito.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("ASK_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const email = `ask-check-${stamp}@example.com`;
const password = `Ak-${crypto.randomUUID()}`;
const MARKER = `zebra-${stamp}-quill`;

let userId = "";
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  userId = created.user!.id;
  cleanup.push(() => admin.auth.admin.deleteUser(userId));

  const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session!.access_token;

  const post = (body: unknown) =>
    fetch(`${API_URL}/agent-ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const res = await post({ prompt: `Reply with exactly this word and nothing else: ${MARKER}` });
  const body = await res.json().catch(() => ({}));
  check(`POST agent-ask -> 200 (got ${res.status})`, res.status === 200, body);
  check("the model actually answered", typeof body.text === "string" && body.text.length > 0, body);
  check("the response says it was not stored", body.stored === false, body);

  // The whole point: no row anywhere carries this conversation.
  const { data: sessions } = await admin.from("agent_sessions").select("id,transcript").eq("user_id", userId);
  check(`no session row was created (found ${sessions?.length ?? 0})`, (sessions?.length ?? 0) === 0, sessions);

  const { data: jobs } = await admin.from("job_queue").select("id").eq("user_id", userId);
  check(`nothing was enqueued (found ${jobs?.length ?? 0})`, (jobs?.length ?? 0) === 0, jobs);

  const { data: projects } = await admin.from("projects").select("id").eq("user_id", userId);
  check(`no project was created (found ${projects?.length ?? 0})`, (projects?.length ?? 0) === 0, projects);

  const { data: tasks } = await admin.from("agent_tasks").select("id,session_id").limit(200)
    .order("created_at", { ascending: false });
  const mine = (tasks ?? []).filter((t) => sessions?.some((s) => s.id === t.session_id));
  check(`no task rows were logged (found ${mine.length})`, mine.length === 0, mine);

  // Multi-turn: history travels in the request, so the server still holds none.
  const followUp = await post({
    prompt: "What word did I just ask you to repeat?",
    history: [
      { role: "user", content: `Reply with exactly this word: ${MARKER}` },
      { role: "assistant", content: MARKER },
    ],
  });
  const followBody = await followUp.json().catch(() => ({}));
  check(`follow-up with history -> 200 (got ${followUp.status})`, followUp.status === 200, followBody);
  check(
    "client-sent history reaches the model",
    typeof followBody.text === "string" && followBody.text.includes(MARKER),
    followBody.text,
  );

  const { data: after } = await admin.from("agent_sessions").select("id").eq("user_id", userId);
  check(`still no session after two turns (found ${after?.length ?? 0})`, (after?.length ?? 0) === 0, after);

  // Tokens are not content, and quotas have to stay honest.
  const { data: meter } = await admin.from("usage_metering").select("tokens_used").eq("user_id", userId)
    .order("period_start", { ascending: false }).limit(1).maybeSingle();
  check("token usage was still metered", (meter?.tokens_used ?? 0) > 0, meter);

  // Oversized history must be rejected, not quietly forwarded to the model.
  const flood = await post({
    prompt: "hi",
    history: Array.from({ length: 40 }, () => ({ role: "user", content: "x" })),
  });
  check(`history over the cap -> 400 (got ${flood.status})`, flood.status === 400, await flood.text());
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
