/**
 * scripts/check-fork.ts
 * ---------------------------------------------------------------------------
 * Exercises the agent-fork endpoint over HTTP, the way the chat screen calls
 * it: sign in as a real user, POST { sessionId, atMessageIndex }, and check the
 * new session's transcript is the source sliced up to and including that index
 * while the source is left untouched.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-fork.ts
 *
 * Point API_URL at the local gateway to test local code, or at the deployed
 * project to test what is actually live.
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("FORK_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const email = `fork-check-${stamp}@example.com`;
const password = `Fk-${crypto.randomUUID()}`;

const transcript = [
  { role: "user", content: "first prompt" },
  { role: "assistant", content: "first answer" },
  { role: "user", content: "second prompt" },
  { role: "assistant", content: "second answer" },
];

let userId = "";
let projectId = "";
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)}`}`);
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

  // sandbox_path is validated against users/<uid>/projects/<pid>, so the row
  // has to be inserted first and then given its real path.
  const { data: project, error: projectErr } = await admin
    .from("projects")
    .insert({ user_id: userId, name: `fork-check-${stamp}`, sandbox_path: "pending" })
    .select()
    .single();
  if (projectErr) throw projectErr;
  projectId = project.id;
  await admin
    .from("projects")
    .update({ sandbox_path: `users/${userId}/projects/${projectId}` })
    .eq("id", projectId);
  cleanup.push(() => admin.from("projects").delete().eq("id", projectId));

  const { data: session, error: sessionErr } = await admin
    .from("agent_sessions")
    .insert({ project_id: projectId, user_id: userId, title: "Fork check", transcript })
    .select()
    .single();
  if (sessionErr) throw sessionErr;

  // Index 2 = the second user prompt, i.e. "branch from here" on that bubble.
  const res = await fetch(`${API_URL}/agent-fork`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId: session.id, atMessageIndex: 2 }),
  });
  const body = await res.json().catch(() => ({}));
  check(`POST agent-fork -> 201 (got ${res.status})`, res.status === 201, body);
  if (res.status !== 201) throw new Error("fork request failed");

  const forkedId = body.session?.id ?? body.id;
  check("response carries the new session id", typeof forkedId === "string", body);

  const { data: forked } = await admin
    .from("agent_sessions")
    .select("id,title,transcript,parent_id,forked_from_index")
    .eq("id", forkedId)
    .maybeSingle();
  check("the forked session was persisted", !!forked, body);

  const forkedTranscript = (forked?.transcript ?? []) as typeof transcript;
  check(
    `fork keeps messages 0..2 (got ${forkedTranscript.length})`,
    forkedTranscript.length === 3,
    forkedTranscript,
  );
  check(
    "the last kept message is the one branched from",
    forkedTranscript.at(-1)?.content === "second prompt",
    forkedTranscript.at(-1),
  );
  check("fork records where it came from", forked?.parent_id === session.id, forked);

  const { data: source } = await admin
    .from("agent_sessions")
    .select("transcript")
    .eq("id", session.id)
    .single();
  check(
    "the original session is untouched",
    ((source?.transcript ?? []) as typeof transcript).length === 4,
    source,
  );

  // A message index past the end must be rejected, not silently clamped.
  const bad = await fetch(`${API_URL}/agent-fork`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId: session.id, atMessageIndex: 99 }),
  });
  check(`out-of-range index -> 400 (got ${bad.status})`, bad.status === 400, await bad.text());
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
