/**
 * scripts/check-quota.ts
 * ---------------------------------------------------------------------------
 * Does the allowance actually stop anyone?
 *
 * A quota that is written down but never enforced is the same as no quota, and
 * the failure is silent — nobody notices until the bill arrives. So this drives
 * a real account against the deployed endpoints until it is refused, and then
 * checks the refusal says something a person can act on.
 *
 * Chat is exercised for real. Builds are checked at the boundary rather than by
 * running four: the point is that the fifth request is refused, and proving it
 * does not require paying for four builds first.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-quota.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  // ── The plan actually stored, which is what the endpoints will read.
  const { data: free } = await admin
    .from("plans")
    .select("build_runs_per_window,chat_messages_per_window,quota_window_hours")
    .eq("key", "free").single();

  console.log(`      free plan: ${JSON.stringify(free)}\n`);
  check("builds are capped at 4", free?.build_runs_per_window === 4, free);
  check("chat is capped at 30", free?.chat_messages_per_window === 30, free);
  check("the window is 12 hours", free?.quota_window_hours === 12, free);

  const email = `quota-${stamp}@example.com`;
  const password = `Qu-${crypto.randomUUID()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  const userId = created.user!.id;
  cleanup.push(() => admin.auth.admin.deleteUser(userId));

  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session!.access_token;

  const call = (name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // ── The counting functions, directly. A window that counts nothing would
  //    make every check below pass for the wrong reason.
  const { data: usedBefore } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "chat", p_window_hours: 12,
  });
  check("a fresh account has used nothing", Number(usedBefore ?? -1) === 0, usedBefore);

  // ── Builds: fill the window by hand, then check the next request is refused.
  //    Four real builds would cost real minutes and real tokens to prove a rule
  //    the database already knows.
  for (let i = 0; i < 4; i++) {
    const { error } = await admin.rpc("quota_record", { p_user_id: userId, p_kind: "build" });
    if (error) throw error;
  }
  const { data: usedBuilds } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "build", p_window_hours: 12,
  });
  check("four builds are counted", Number(usedBuilds ?? 0) === 4, usedBuilds);

  const project = await call("projects-create", { name: `Quota ${stamp}`, template: "blank" });
  const projectId = (await project.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  const refused = await call("agent-run", { projectId, prompt: "make me anything" });
  const refusedBody = await refused.json().catch(() => ({}));
  check(`the fifth build is refused (${refused.status})`, refused.status === 429, refusedBody);
  check(
    "the refusal says the limit, the window and when to come back",
    /4 builds/.test(JSON.stringify(refusedBody)) &&
      /12 hours/.test(JSON.stringify(refusedBody)) &&
      /in \d/.test(JSON.stringify(refusedBody)),
    refusedBody,
  );
  check(
    "it does not offer an upgrade that does not exist",
    !/upgrade|subscri/i.test(JSON.stringify(refusedBody)),
    refusedBody,
  );

  // ── A refused request must not be charged for.
  const { data: afterRefusal } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "build", p_window_hours: 12,
  });
  check(
    "the refused request was not itself counted",
    Number(afterRefusal ?? 0) === 4,
    { before: 4, after: afterRefusal },
  );

  // ── Chat is metered separately, so a spent build allowance must not block it.
  //    Whether the model answers is not this script's business — the gateway
  //    running out of credit is a real and separate failure — so this only
  //    asserts the quota did not stand in the way.
  const chat = await call("agent-ask", { prompt: "In one short sentence, what is a variable?" });
  const chatBody = await chat.json().catch(() => ({}));
  check(
    `a spent build allowance does not block chat (${chat.status})`,
    chat.status !== 429,
    chatBody,
  );
  if (!chat.ok) {
    console.log(`      note: the model itself failed (${chat.status}) — quota was not the reason
`);
  }

  const { data: usedChat } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "chat", p_window_hours: 12,
  });
  check(
    chat.ok
      ? "the answered question was counted once"
      : "an unanswered question was not charged for",
    Number(usedChat ?? 0) === (chat.ok ? 1 : 0),
    usedChat,
  );

  // ── The chat ceiling. Filled to exactly the limit rather than assuming the
  //    request above landed, so this proves the same thing whether or not the
  //    model is up — the refusal happens before the model is ever called.
  const { data: chatSoFar } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "chat", p_window_hours: 12,
  });
  for (let i = Number(chatSoFar ?? 0); i < 30; i++) {
    await admin.rpc("quota_record", { p_user_id: userId, p_kind: "chat" });
  }
  const chatRefused = await call("agent-ask", { prompt: "one more" });
  const chatRefusedBody = await chatRefused.json().catch(() => ({}));
  check(`the 31st message is refused (${chatRefused.status})`, chatRefused.status === 429, chatRefusedBody);
  check(
    "the chat refusal names messages, not builds",
    /30 messages/.test(JSON.stringify(chatRefusedBody)),
    chatRefusedBody,
  );

  // ── An old event must not count. This is the whole point of a rolling window.
  await admin.from("quota_events")
    .update({ created_at: new Date(Date.now() - 13 * 3600_000).toISOString() })
    .eq("user_id", userId).eq("kind", "build");
  const { data: aged } = await admin.rpc("quota_used", {
    p_user_id: userId, p_kind: "build", p_window_hours: 12,
  });
  check("events older than the window stop counting", Number(aged ?? -1) === 0, aged);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
