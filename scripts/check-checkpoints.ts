/**
 * scripts/check-checkpoints.ts
 * ---------------------------------------------------------------------------
 * Rollback is the one operation that deletes a user's files, so the unit tests
 * are not enough — this drives it against real Supabase Storage and the real
 * HTTP endpoint, as the owner, and checks the bytes afterwards.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-checkpoints.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { createCheckpoint } from "../supabase/functions/shared/checkpoints.ts";
import { PROJECT_FILES_BUCKET, downloadBlob, listStorageFiles, removeStoragePrefix, uploadBlob } from "../supabase/functions/shared/storage.ts";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("CHECKPOINT_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const email = `cp-check-${stamp}@example.com`;
const password = `Cp-${crypto.randomUUID()}`;

let userId = "";
let projectId = "";
let sandboxPath = "";
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

const readFile = async (name: string) =>
  await (await downloadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/${name}`)).text();

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  userId = created.user!.id;
  cleanup.push(() => admin.auth.admin.deleteUser(userId));

  const anonClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session!.access_token;

  const { data: project, error: projectErr } = await admin
    .from("projects").insert({ user_id: userId, name: `cp-check-${stamp}`, sandbox_path: "pending" })
    .select().single();
  if (projectErr) throw projectErr;
  projectId = project.id;
  sandboxPath = `users/${userId}/projects/${projectId}`;
  await admin.from("projects").update({ sandbox_path: sandboxPath }).eq("id", projectId);
  cleanup.push(() => admin.from("projects").delete().eq("id", projectId));
  cleanup.push(() => removeStoragePrefix(admin, PROJECT_FILES_BUCKET, sandboxPath));

  // A project as it stands before a run.
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/index.html`, "<h1>v1</h1>", "text/html");
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/src/app.js`, "console.log('v1')", "text/javascript");

  const snapshot = await createCheckpoint(admin, { projectId, sandboxPath });
  check("snapshot was created", snapshot.created === true, snapshot);
  if (!snapshot.created) throw new Error("cannot continue without a snapshot");
  check(`snapshot covers both files (got ${snapshot.fileCount})`, snapshot.fileCount === 2, snapshot);

  // The agent edits a file and adds one.
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/index.html`, "<h1>v2</h1>", "text/html");
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/junk.txt`, "added later", "text/plain");
  check("the project really changed", (await readFile("index.html")) === "<h1>v2</h1>");

  // Another user must not be able to roll this back with just the id.
  const strangerEmail = `cp-stranger-${stamp}@example.com`;
  const strangerPassword = `Cs-${crypto.randomUUID()}`;
  const { data: stranger } = await admin.auth.admin.createUser({
    email: strangerEmail, password: strangerPassword, email_confirm: true,
  });
  cleanup.push(() => admin.auth.admin.deleteUser(stranger!.user!.id));
  const { data: strangerSignIn } = await anonClient.auth.signInWithPassword({
    email: strangerEmail, password: strangerPassword,
  });
  const strangerRes = await fetch(`${API_URL}/checkpoint-restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${strangerSignIn!.session!.access_token}`,
    },
    body: JSON.stringify({ checkpointId: snapshot.checkpoint.id }),
  });
  // Assert on the error code too: a routing 404 would otherwise look like a
  // successful authorization check.
  const strangerBody = await strangerRes.json().catch(() => ({}));
  check(
    `another user is refused with CHECKPOINT_NOT_FOUND (got ${strangerRes.status})`,
    strangerRes.status === 404 && strangerBody?.error?.code === "CHECKPOINT_NOT_FOUND",
    strangerBody,
  );
  check("their attempt changed nothing", (await readFile("index.html")) === "<h1>v2</h1>");

  // The owner rolls back over HTTP, exactly as the app does.
  const res = await fetch(`${API_URL}/checkpoint-restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ checkpointId: snapshot.checkpoint.id }),
  });
  const body = await res.json().catch(() => ({}));
  check(`owner restore -> 200 (got ${res.status})`, res.status === 200, body);
  check(`restored both files (got ${body.files_restored})`, body.files_restored === 2, body);

  check("the edited file is back to v1", (await readFile("index.html")) === "<h1>v1</h1>");
  const paths = await listStorageFiles(admin, PROJECT_FILES_BUCKET, sandboxPath);
  check(
    "the file added after the snapshot is gone",
    !paths.some((p) => p.endsWith("junk.txt")),
    paths,
  );
  check("the nested file survived the round trip", (await readFile("src/app.js")) === "console.log('v1')");

  // The rollback itself must be undoable.
  check("a safety snapshot was taken", typeof body.safety_checkpoint_id === "string", body);
  const undo = await fetch(`${API_URL}/checkpoint-restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ checkpointId: body.safety_checkpoint_id }),
  });
  check(`undo the rollback -> 200 (got ${undo.status})`, undo.status === 200, await undo.clone().text());
  check("v2 came back", (await readFile("index.html")) === "<h1>v2</h1>");
  check("so did the later file", (await listStorageFiles(admin, PROJECT_FILES_BUCKET, sandboxPath)).some((p) => p.endsWith("junk.txt")));

  // The owner can see their history under RLS with their own token.
  const ownerClient = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: visible, error: visibleErr } = await ownerClient
    .from("checkpoints").select("id,project_id,session_id,created_at,agent_sessions(title)")
    .eq("project_id", projectId);
  check("the owner can list their checkpoints under RLS", !visibleErr && (visible?.length ?? 0) >= 2, visibleErr ?? visible);
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
