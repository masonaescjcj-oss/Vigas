/**
 * scripts/check-worker-checkpoint.ts
 * ---------------------------------------------------------------------------
 * The rollback buttons are only real if the worker actually snapshots before it
 * runs. That path cannot be unit tested without stubbing the whole agent, so
 * this drives one real job through processNextJob and then checks that a
 * checkpoint row exists, that it captured the state *before* the agent wrote,
 * and that its id reached the task row the chat screen reads.
 *
 * It calls the model once, so it costs a small number of tokens.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-worker-checkpoint.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { processNextJob } from "../supabase/functions/queue-worker/index.ts";
import {
  CHECKPOINTS_BUCKET,
  PROJECT_FILES_BUCKET,
  downloadBlob,
  joinStoragePath,
  removeStoragePrefix,
  uploadBlob,
} from "../supabase/functions/shared/storage.ts";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const email = `wcp-check-${stamp}@example.com`;

let userId = "";
let projectId = "";
let sandboxPath = "";
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 500)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: `Wc-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  userId = created.user!.id;
  cleanup.push(() => admin.auth.admin.deleteUser(userId));

  const { data: project, error: projectErr } = await admin
    .from("projects").insert({ user_id: userId, name: `wcp-check-${stamp}`, sandbox_path: "pending" })
    .select().single();
  if (projectErr) throw projectErr;
  projectId = project.id;
  sandboxPath = `users/${userId}/projects/${projectId}`;
  await admin.from("projects").update({ sandbox_path: sandboxPath }).eq("id", projectId);
  cleanup.push(() => admin.from("projects").delete().eq("id", projectId));
  cleanup.push(() => removeStoragePrefix(admin, PROJECT_FILES_BUCKET, sandboxPath));

  const BEFORE = "<h1>before the agent ran</h1>";
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/index.html`, BEFORE, "text/html");

  const sessionId = crypto.randomUUID();
  const { error: sessionErr } = await admin.from("agent_sessions")
    .insert({ id: sessionId, project_id: projectId, user_id: userId, title: "Worker checkpoint check", profile: "standard" });
  if (sessionErr) throw sessionErr;

  const { data: job, error: jobErr } = await admin.from("job_queue").insert({
    user_id: userId,
    project_id: projectId,
    session_id: sessionId,
    payload: {
      mode: "run",
      prompt: "Replace the contents of index.html with exactly: <h1>after</h1>",
      profile: "standard",
      sandbox_path: sandboxPath,
    },
  }).select("id").single();
  if (jobErr) throw jobErr;

  console.log("running the job (this calls the model once)…");
  const result = await processNextJob(admin, `check-${stamp}`);
  check(`the job was processed (status ${result.status})`, result.processed === true, result);
  check("the worker claimed our job", result.jobId === job.id, { got: result.jobId, want: job.id });

  const { data: checkpoints } = await admin
    .from("checkpoints").select("id,snapshot_path,session_id").eq("project_id", projectId);
  check(`exactly one checkpoint was created (got ${checkpoints?.length ?? 0})`, checkpoints?.length === 1, checkpoints);

  const checkpoint = checkpoints?.[0];
  if (checkpoint) {
    check("the checkpoint is linked to the session", checkpoint.session_id === sessionId, checkpoint);

    // The whole point: the snapshot holds the state from BEFORE the run.
    const snapshot = await downloadBlob(
      admin,
      CHECKPOINTS_BUCKET,
      joinStoragePath(String(checkpoint.snapshot_path), "index.html"),
    );
    check("the snapshot holds the pre-run contents", (await snapshot.text()) === BEFORE);
    cleanup.push(() => removeStoragePrefix(admin, CHECKPOINTS_BUCKET, String(checkpoint.snapshot_path)));
  }

  // And the id has to reach the UI, or the rollback button never appears.
  const { data: task } = await admin
    .from("agent_tasks").select("status,tool_output")
    .eq("session_id", sessionId).eq("tool_name", "agent-run")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const output = (task?.tool_output ?? {}) as Record<string, unknown>;
  check(`the run finished (status ${task?.status})`, task?.status === "success", task);
  check("the task row carries the checkpoint id", output.checkpoint_id === checkpoint?.id, output);
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
