/**
 * scripts/check-run-profile.ts
 * ---------------------------------------------------------------------------
 * Chat mode promises the agent cannot change your project. That promise is only
 * worth anything if the profile the client sends actually reaches the worker,
 * so this checks the whole hand-off: agent-run with profile "readonly" must
 * store readonly on the session AND put readonly in the job payload the worker
 * reads, and a later turn must not be able to quietly upgrade itself.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-run-profile.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("RUN_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const email = `profile-check-${stamp}@example.com`;
const password = `Pf-${crypto.randomUUID()}`;

let userId = "";
let projectId = "";
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

  const { data: project, error: projectErr } = await admin
    .from("projects")
    .insert({ user_id: userId, name: `profile-check-${stamp}`, sandbox_path: "pending" })
    .select()
    .single();
  if (projectErr) throw projectErr;
  projectId = project.id;
  await admin.from("projects").update({ sandbox_path: `users/${userId}/projects/${projectId}` }).eq("id", projectId);
  cleanup.push(() => admin.from("projects").delete().eq("id", projectId));

  const run = (body: unknown) =>
    fetch(`${API_URL}/agent-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // What the UI sends in Chat mode.
  const res = await run({ projectId, prompt: "what does this project do?", profile: "readonly" });
  const body = await res.json().catch(() => ({}));
  check(`agent-run (readonly) -> 202 (got ${res.status})`, res.status === 202, body);
  if (res.status !== 202) throw new Error("run request failed");

  const sessionId = body.session_id;
  const { data: session } = await admin
    .from("agent_sessions").select("id,profile").eq("id", sessionId).maybeSingle();
  check("the session is stored as readonly", session?.profile === "readonly", session);

  const { data: job } = await admin
    .from("job_queue").select("id,payload,status").eq("id", body.job_id).maybeSingle();
  check("the worker's payload carries readonly", (job?.payload as any)?.profile === "readonly", job?.payload);

  // A follow-up that claims "standard" must not escalate an existing readonly
  // chat — the stored profile wins.
  await admin.from("job_queue").delete().eq("id", body.job_id); // free the one-run-per-session lock
  const followUp = await run({ projectId, prompt: "now delete everything", sessionId, profile: "standard" });
  const followBody = await followUp.json().catch(() => ({}));
  check(`follow-up accepted (got ${followUp.status})`, followUp.status === 202, followBody);
  const { data: job2 } = await admin
    .from("job_queue").select("payload").eq("id", followBody.job_id).maybeSingle();
  check(
    "a readonly chat cannot be upgraded mid-conversation",
    (job2?.payload as any)?.profile === "readonly",
    job2?.payload,
  );

  // Build mode, for contrast.
  const buildRes = await run({ projectId, prompt: "build me a page", profile: "standard" });
  const buildBody = await buildRes.json().catch(() => ({}));
  const { data: buildJob } = await admin
    .from("job_queue").select("payload").eq("id", buildBody.job_id).maybeSingle();
  check(
    "build mode still gets the standard profile",
    (buildJob?.payload as any)?.profile === "standard",
    buildJob?.payload,
  );
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
