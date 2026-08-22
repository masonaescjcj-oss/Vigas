/**
 * scripts/check-real-build.ts
 * ---------------------------------------------------------------------------
 * The one thing nothing else proves: does a real prompt produce a working app?
 *
 * Every other check tests a part. This drives the whole product loop against the
 * deployed backend — enqueue, cron picks it up, the worker runs the agent, the
 * agent calls tools, files land in Storage, and the result is something that could
 * be previewed and shipped. If this passes, the product works; if it fails, nothing
 * else mattering is much comfort.
 *
 * It is slow on purpose (a real model, real tool calls) and it costs a few cents.
 *
 *   PROVIDER_API_URL=https://<ref>.supabase.co/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-real-build.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

/** A build involves several model round trips; cron polls every 10 seconds. */
const RUN_TIMEOUT_MS = 300_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  // ── A real account, signed in the way the app signs in.
  const email = `build-${stamp}@example.com`;
  const password = `Bu-${crypto.randomUUID()}`;
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

  // The trigger should have given the new account a profile.
  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  check("signing up creates a profile row (the trigger fires)", profile?.id === userId, profile);

  const call = (name: string, body: unknown) =>
    fetch(`${API_URL}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // ── A project, created the way the app creates one.
  const createProject = await call("projects-create", { name: `Build check ${stamp}`, template: "landing" });
  const projectBody = await createProject.json().catch(() => ({}));
  check(`a project can be created (${createProject.status})`, createProject.ok, projectBody);
  const projectId = projectBody?.project?.id ?? projectBody?.id;
  if (!projectId) throw new Error("no project id came back; nothing below would mean anything.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  const seeded = await call("project-files", { projectId });
  const seededBody = await seeded.json().catch(() => ({}));
  const seededNames = Object.keys(seededBody?.files ?? {});
  check(`the template seeded real files (${seededNames.join(", ")})`, seededNames.length > 0, seededBody);

  // ── The actual build.
  const prompt = `Change the main heading of index.html to exactly "Retro Build ${stamp}". Change nothing else.`;
  const run = await call("agent-run", { projectId, prompt, title: `Build check ${stamp}` });
  const runBody = await run.json().catch(() => ({}));
  check(`the run is accepted (${run.status})`, run.status === 202 || run.ok, runBody);
  const sessionId = runBody?.session_id;
  if (!sessionId) throw new Error("no session id came back.");

  console.log(`\n      queued — waiting for cron and the worker (up to ${RUN_TIMEOUT_MS / 1000}s)\n`);

  // ── Wait for the worker. This is the part that proves cron, pg_net, Vault, the
  //    worker secret and the agent are all wired to each other.
  const started = Date.now();
  let finalRow: { status: string; tool_output: Record<string, unknown> } | null = null;
  let sawRunning = false;

  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const { data: tasks } = await admin
      .from("agent_tasks").select("tool_name,status,tool_output")
      .eq("session_id", sessionId).order("created_at", { ascending: true });

    if (tasks?.some((t) => t.status === "running")) sawRunning = true;
    const terminal = tasks?.find((t) => t.tool_name === "agent-run" && ["success", "failed"].includes(t.status));
    if (terminal) {
      finalRow = terminal as typeof finalRow;
      break;
    }
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`      ${elapsed}s — ${tasks?.length ?? 0} steps so far`);
  }

  check("cron reached the worker and the run started", sawRunning || !!finalRow,
    "nothing ever moved: cron, Vault or the worker secret is wrong");
  check("the run finished within the timeout", !!finalRow, "still pending after the timeout");

  if (finalRow) {
    check(`the run succeeded (${finalRow.status})`, finalRow.status === "success",
      finalRow.tool_output);

    const { data: steps } = await admin
      .from("agent_tasks").select("tool_name,status").eq("session_id", sessionId);
    const toolNames = (steps ?? []).map((s) => s.tool_name).filter((n) => n !== "agent-run");
    check(`the agent used tools (${toolNames.join(", ") || "none"})`, toolNames.length > 0, steps);

    // ── The point of the whole thing: did the file actually change?
    const after = await call("project-files", { projectId });
    const afterBody = await after.json().catch(() => ({}));
    const html = String(afterBody?.files?.["index.html"] ?? "");
    check("index.html still exists after the run", html.length > 0, Object.keys(afterBody?.files ?? {}));
    check(
      `the heading the prompt asked for is in the file`,
      html.includes(`Retro Build ${stamp}`),
      html.slice(0, 400),
    );

    // ── And a checkpoint exists, so the change can be undone.
    const { count } = await admin
      .from("checkpoints").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    check(`a checkpoint was taken before the run (found ${count})`, (count ?? 0) > 0);

    // ── Usage was metered, or the free-tier limit means nothing.
    const { data: usage } = await admin
      .from("usage_metering").select("tokens_used").eq("user_id", userId).maybeSingle();
    check(`tokens were metered (${usage?.tokens_used ?? 0})`, (usage?.tokens_used ?? 0) > 0, usage);
  }
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await step().catch(() => {});
}
