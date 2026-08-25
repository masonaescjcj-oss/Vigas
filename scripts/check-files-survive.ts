/**
 * scripts/check-files-survive.ts
 * ---------------------------------------------------------------------------
 * Do the user's files stay put?
 *
 * The sandbox is destroyed after every job, so Storage is the only place a
 * project actually lives. The sync that mirrors one into the other deletes any
 * Storage file the sandbox does not list — right when the agent removed it,
 * catastrophic when the listing is wrong, and `listFiles` returns an empty
 * array for a directory that does not exist.
 *
 * It also used to upload whatever the sandbox held, so one `npm install` would
 * try to put every file in node_modules into the project.
 *
 * This drives both against the deployed stack: run a command, then check the
 * files that were there before are still there, and that the sandbox's own
 * files did not come along.
 *
 *   PROVIDER_API_URL=https://<ref>.supabase.co/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-files-survive.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

/** An install on a one-core box is not quick. */
const RUN_TIMEOUT_MS = 480_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 600)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `files-${stamp}@example.com`;
  const password = `Fi-${crypto.randomUUID()}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  cleanup.push(() => admin.auth.admin.deleteUser(created.user!.id));

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

  const createProject = await call("projects-create", { name: `Files ${stamp}`, template: "landing" });
  const projectId = (await createProject.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  const before = await (await call("project-files", { projectId })).json().catch(() => ({}));
  const beforeNames = Object.keys(before?.files ?? {}).sort();
  check(`the template seeded files (${beforeNames.join(", ")})`, beforeNames.length > 0, before);

  // A command that creates a sandbox full of files the project must not gain,
  // and touches nothing the project already has.
  const prompt =
    "Run exactly this one bash command and then stop and tell me the exit code: " +
    "`npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund lodash 2>&1 | tail -2`. " +
    "Do not write, edit or delete any file yourself. Do not run anything else.";
  const run = await call("agent-run", { projectId, prompt, title: `Files ${stamp}` });
  const sessionId = (await run.json().catch(() => ({})))?.session_id;
  if (!sessionId) throw new Error("no session id came back.");

  console.log(`\n      running an install in the sandbox (up to ${RUN_TIMEOUT_MS / 1000}s)\n`);

  const started = Date.now();
  let finished = false;
  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const { data: rows } = await admin
      .from("agent_tasks").select("tool_name,status,tool_output")
      .eq("session_id", sessionId).order("created_at", { ascending: true });
    const last = [...(rows ?? [])].reverse().find((r) => r.tool_name === "agent-run");
    if (last && ["success", "failed"].includes(last.status) && last.tool_output?.continued !== true) {
      finished = true;
      console.log(`      run ${last.status}: ${String(last.tool_output?.final_text ?? last.tool_output?.error ?? "").slice(0, 200)}\n`);
      break;
    }
    console.log(`      ${Math.round((Date.now() - started) / 1000)}s — ${(rows ?? []).length} steps`);
  }
  check("the run finished within the timeout", finished, "still going after the timeout");

  // ── The whole point.
  const after = await (await call("project-files", { projectId })).json().catch(() => ({}));
  const afterNames = Object.keys(after?.files ?? {}).sort();

  const lost = beforeNames.filter((name) => !afterNames.includes(name));
  check(
    `every file that was there before is still there${lost.length ? "" : ` (${afterNames.length})`}`,
    lost.length === 0,
    { lost, after: afterNames.slice(0, 20) },
  );

  const sandboxJunk = afterNames.filter((name) =>
    name.includes("node_modules") || name.startsWith(".git/") || name.endsWith(".log")
  );
  check(
    "the sandbox's own files did not become the user's",
    sandboxJunk.length === 0,
    { count: sandboxJunk.length, sample: sandboxJunk.slice(0, 10) },
  );

  check(
    `the project stayed a readable size (${afterNames.length} files)`,
    afterNames.length < 100,
    afterNames.slice(0, 20),
  );

  console.log(`\n      files now: ${afterNames.join(", ")}\n`);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
