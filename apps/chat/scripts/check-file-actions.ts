/**
 * scripts/check-file-actions.ts
 * ---------------------------------------------------------------------------
 * The file tree and the file viewer used to hit Storage directly, which its RLS
 * denies — reads came back empty with no error and saves were rejected. They go
 * through project-files now, so this drives that endpoint as a real signed-in
 * user: list, write, rename, delete, and the refusals that keep one user out of
 * another's files.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-file-actions.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { PROJECT_FILES_BUCKET, removeStoragePrefix, uploadBlob } from "../supabase/functions/shared/storage.ts";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("FILES_API_URL") ?? "http://localhost:54321/functions/v1";

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);

let projectId = "";
let sandboxPath = "";
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function makeUser(tag: string) {
  const email = `files-${tag}-${stamp}@example.com`;
  const password = `Fa-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  cleanup.push(() => admin.auth.admin.deleteUser(data.user!.id));
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user!.id, token: signIn.session!.access_token };
}

try {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");

  const { data: project, error: projectErr } = await admin
    .from("projects").insert({ user_id: owner.id, name: `files-${stamp}`, sandbox_path: "pending" })
    .select().single();
  if (projectErr) throw projectErr;
  projectId = project.id;
  sandboxPath = `users/${owner.id}/projects/${projectId}`;
  await admin.from("projects").update({ sandbox_path: sandboxPath }).eq("id", projectId);
  cleanup.push(() => admin.from("projects").delete().eq("id", projectId));
  cleanup.push(() => removeStoragePrefix(admin, PROJECT_FILES_BUCKET, sandboxPath));

  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/index.html`, "<h1>hi</h1>", "text/html");
  await uploadBlob(admin, PROJECT_FILES_BUCKET, `${sandboxPath}/src/app.js`, "console.log(1)", "text/javascript");

  const call = (token: string, body: unknown) =>
    fetch(`${API_URL}/project-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  // List — the read the file tree and the preview both depend on.
  const listRes = await call(owner.token, { projectId });
  const listBody = await listRes.json().catch(() => ({}));
  check(`list -> 200 (got ${listRes.status})`, listRes.status === 200, listBody);
  check("the owner sees both files, nested path included",
    Object.keys(listBody.files ?? {}).sort().join(",") === "index.html,src/app.js", listBody.files);

  // Write — what "Save" in the file viewer does.
  const writeRes = await call(owner.token, {
    projectId, action: "write", path: "src/app.js", content: "console.log('edited')",
  });
  check(`write -> 200 (got ${writeRes.status})`, writeRes.status === 200, await writeRes.clone().text());
  const afterWrite = await (await call(owner.token, { projectId })).json();
  check("the edit is readable back", afterWrite.files?.["src/app.js"] === "console.log('edited')", afterWrite.files);

  // Write can also create a file that did not exist.
  await call(owner.token, { projectId, action: "write", path: "notes/todo.md", content: "# todo" });
  const afterCreate = await (await call(owner.token, { projectId })).json();
  check("write creates a new nested file", afterCreate.files?.["notes/todo.md"] === "# todo", Object.keys(afterCreate.files ?? {}));

  // Rename.
  const renameRes = await call(owner.token, {
    projectId, action: "rename", path: "notes/todo.md", toPath: "notes/tasks.md",
  });
  check(`rename -> 200 (got ${renameRes.status})`, renameRes.status === 200, await renameRes.clone().text());
  const afterRename = await (await call(owner.token, { projectId })).json();
  check("the new name is there and the old one is gone",
    afterRename.files?.["notes/tasks.md"] === "# todo" && !("notes/todo.md" in (afterRename.files ?? {})),
    Object.keys(afterRename.files ?? {}));

  // Delete.
  const deleteRes = await call(owner.token, { projectId, action: "delete", path: "notes/tasks.md" });
  check(`delete -> 200 (got ${deleteRes.status})`, deleteRes.status === 200, await deleteRes.clone().text());
  const afterDelete = await (await call(owner.token, { projectId })).json();
  check("the file is gone", !("notes/tasks.md" in (afterDelete.files ?? {})), Object.keys(afterDelete.files ?? {}));
  check("the other files survived", "index.html" in (afterDelete.files ?? {}), Object.keys(afterDelete.files ?? {}));

  // A path that climbs out of the project must be rejected by validation, not
  // normalised into something that happens to be safe.
  const traversal = await call(owner.token, {
    projectId, action: "write", path: "../../../etc/passwd", content: "nope",
  });
  check(`path traversal -> 400 (got ${traversal.status})`, traversal.status === 400, await traversal.text());

  const absolute = await call(owner.token, { projectId, action: "delete", path: "/index.html" });
  check(`absolute path -> 400 (got ${absolute.status})`, absolute.status === 400, await absolute.text());

  // Another user must not touch this project at all.
  const strangerList = await call(stranger.token, { projectId });
  check(`a stranger cannot list (got ${strangerList.status})`, strangerList.status === 404, await strangerList.text());
  const strangerWrite = await call(stranger.token, {
    projectId, action: "write", path: "index.html", content: "defaced",
  });
  check(`a stranger cannot write (got ${strangerWrite.status})`, strangerWrite.status === 404, await strangerWrite.text());
  const stillMine = await (await call(owner.token, { projectId })).json();
  check("their attempt changed nothing", stillMine.files?.["index.html"] === "<h1>hi</h1>", stillMine.files);
} catch (error) {
  console.log("ERROR", error instanceof Error ? error.message : error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) {
    try { await step(); } catch { /* best effort */ }
  }
  console.log("cleaned up");
}
