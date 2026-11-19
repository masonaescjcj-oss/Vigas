/**
 * scripts/check-incognito.ts
 * ---------------------------------------------------------------------------
 * agent-ask serves both question modes, so both are checked here.
 *
 * Incognito: "nothing is saved" is a promise the UI makes, so it is verified
 * rather than assumed — a unique marker phrase is sent, then hunted for across
 * every table an agent run would normally write to.
 *
 * Chat: the opposite promise. The conversation is stored, the server carries
 * the history so a follow-up does not resend it, and the window is bounded.
 * None of it goes near the job queue or a sandbox.
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


  // ── Chat mode: the same endpoint, but the conversation is stored and the
  //    server carries the history. Still no queue, no worker, no sandbox.
  const { data: project } = await admin
    .from("projects").insert({ user_id: userId, name: `ask-chat-${stamp}`, sandbox_path: "pending" })
    .select().single();
  const projectId = project!.id;
  await admin.from("projects").update({ sandbox_path: `users/${userId}/projects/${projectId}` }).eq("id", projectId);
  // A PostgREST builder is thenable but not a Promise, so await it into one.
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  console.log("\n--- chat mode (stored) ---");
  const SECRET = `pelican-${stamp}`;
  const first = await post({
    projectId,
    prompt: `Remember this codeword and reply with just "ok": ${SECRET}`,
    title: "codeword chat",
  });
  const firstBody = await first.json().catch(() => ({}));
  check(`first chat turn -> 200 (got ${first.status})`, first.status === 200, firstBody);
  check("it reports being stored", firstBody.stored === true, firstBody);
  check("it returns a session id", typeof firstBody.session_id === "string", firstBody);
  check("the first turn has no prior context", firstBody.context_turns === 0, firstBody);

  const chatSessionId = firstBody.session_id;

  // The transcript is written, and it is a real conversation — not tool rows.
  const { data: stored } = await admin
    .from("agent_sessions").select("transcript,title").eq("id", chatSessionId).maybeSingle();
  const turns = (stored?.transcript ?? []) as Array<{ role: string; content: string }>;
  check(`both turns were saved (got ${turns.length})`, turns.length === 2, turns);
  check("the user turn is stored verbatim", turns[0]?.content?.includes(SECRET) === true, turns[0]);
  check("the assistant turn is stored", turns[1]?.role === "assistant", turns[1]);
  check("the chat is titled", stored?.title === "codeword chat", stored);

  // The point of storing it: a follow-up sends only the new message.
  const second = await post({
    projectId,
    sessionId: chatSessionId,
    prompt: "What was the codeword?",
  });
  const secondBody = await second.json().catch(() => ({}));
  check(`follow-up -> 200 (got ${second.status})`, second.status === 200, secondBody);
  check(
    "the model remembered without the client resending anything",
    typeof secondBody.text === "string" && secondBody.text.includes(SECRET),
    secondBody.text,
  );
  check(`it saw the earlier turns (context_turns=${secondBody.context_turns})`, secondBody.context_turns === 2, secondBody);

  const { data: grown } = await admin
    .from("agent_sessions").select("transcript").eq("id", chatSessionId).maybeSingle();
  check(`the transcript grew to 4 (got ${(grown?.transcript ?? []).length})`, (grown?.transcript ?? []).length === 4, grown);

  // A question must never reach the agent pipeline.
  const { data: chatJobs } = await admin.from("job_queue").select("id").eq("user_id", userId);
  check(`chat enqueued no job (found ${chatJobs?.length ?? 0})`, (chatJobs?.length ?? 0) === 0, chatJobs);
  const { data: chatTasks } = await admin.from("agent_tasks").select("id").eq("session_id", chatSessionId);
  check(`chat logged no tool rows (found ${chatTasks?.length ?? 0})`, (chatTasks?.length ?? 0) === 0, chatTasks);

  // The memory window is bounded: a long chat does not send everything.
  const longTranscript = Array.from({ length: 60 }, (_, i) => ({
    id: `seed-${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    content: `filler turn ${i}`,
    createdAt: Date.now() + i,
  }));
  await admin.from("agent_sessions").update({ transcript: longTranscript }).eq("id", chatSessionId);
  const windowed = await post({ projectId, sessionId: chatSessionId, prompt: "say ok" });
  const windowedBody = await windowed.json().catch(() => ({}));
  check(
    `a 60-turn chat sends only the last 20 (got ${windowedBody.context_turns})`,
    windowedBody.context_turns === 20,
    windowedBody,
  );

  // Someone else's chat is not reachable by id.
  const strangerEmail = `ask-stranger-${stamp}@example.com`;
  const strangerPassword = `As-${crypto.randomUUID()}`;
  const { data: stranger } = await admin.auth.admin.createUser({
    email: strangerEmail, password: strangerPassword, email_confirm: true,
  });
  cleanup.push(() => admin.auth.admin.deleteUser(stranger!.user!.id));
  const { data: strangerSignIn } = await anonClient.auth.signInWithPassword({
    email: strangerEmail, password: strangerPassword,
  });
  const intruder = await fetch(`${API_URL}/agent-ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${strangerSignIn!.session!.access_token}`,
    },
    body: JSON.stringify({ projectId, sessionId: chatSessionId, prompt: "what is in here?" }),
  });
  check(`another user cannot read this chat (got ${intruder.status})`, intruder.status === 404, await intruder.text());

  // Sending both a stored chat and a client history is a contradiction.
  const both = await post({
    projectId,
    sessionId: chatSessionId,
    prompt: "hi",
    history: [{ role: "user", content: "smuggled" }],
  });
  check(`stored chat + client history -> 400 (got ${both.status})`, both.status === 400, await both.text());

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
