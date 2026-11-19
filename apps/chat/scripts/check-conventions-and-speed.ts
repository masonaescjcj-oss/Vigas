/**
 * scripts/check-conventions-and-speed.ts
 * ---------------------------------------------------------------------------
 * Two things the unit tests cannot prove, checked against the deployed stack.
 *
 * 1. A project's own AGENTS.md reaches the agent. The loader is tested against
 *    a fake workspace; this checks it survives the real one — Supabase Storage,
 *    the real prompt assembly, the real worker.
 *
 * 2. Independent file writes go out together. Locally the proof is a hook
 *    counting overlap; here it is the shape of the run — several files from one
 *    round rather than one file per step.
 *
 * Deliberately a small request: this costs real model tokens on the configured
 * gateway, and neither claim needs a large build to show.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-conventions-and-speed.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

const RUN_TIMEOUT_MS = 300_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 600)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `conv-${stamp}@example.com`;
  const password = `Cv-${crypto.randomUUID()}`;
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

  const createProject = await call("projects-create", { name: `Conventions ${stamp}`, template: "landing" });
  const projectId = (await createProject.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  // A convention the agent could not possibly guess, so its presence in the
  // output can only come from the file having been read.
  const marker = `ZZTOP-${stamp.toUpperCase()}`;
  const conventions = [
    "# Project conventions",
    "",
    `- Every HTML file must contain the exact comment: <!-- ${marker} -->`,
    "- Put it immediately after the opening <body> tag.",
  ].join("\n");

  const { data: project } = await admin.from("projects").select("sandbox_path").eq("id", projectId).single();
  const { error: upErr } = await admin.storage
    .from("project-files")
    .upload(`${project!.sandbox_path}/AGENTS.md`, new Blob([conventions], { type: "text/markdown" }), { upsert: true });
  if (upErr) throw upErr;
  check("AGENTS.md was placed in the project", true);

  const prompt =
    "Create three separate pages: about.html, contact.html and pricing.html. " +
    "Each one a simple complete HTML page with a heading. " +
    "Do not ask me any questions and do not read anything first — just write the three files.";
  const run = await call("agent-run", { projectId, prompt, title: `Conventions ${stamp}` });
  const sessionId = (await run.json().catch(() => ({})))?.session_id;
  if (!sessionId) throw new Error("no session id came back.");

  console.log(`\n      running (up to ${RUN_TIMEOUT_MS / 1000}s)\n`);

  const started = Date.now();
  let finished = false;
  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const { data: rows } = await admin
      .from("agent_tasks").select("tool_name,status,tool_output,created_at")
      .eq("session_id", sessionId).order("created_at", { ascending: true });
    const last = [...(rows ?? [])].reverse().find((r) => r.tool_name === "agent-run");
    if (last && ["success", "failed"].includes(last.status) && last.tool_output?.continued !== true) {
      finished = true;
      console.log(`      ${last.status}: ${String(last.tool_output?.final_text ?? last.tool_output?.error ?? "").slice(0, 160)}\n`);
      break;
    }
    console.log(`      ${Math.round((Date.now() - started) / 1000)}s — ${(rows ?? []).length} steps`);
  }
  check("the run finished within the timeout", finished, "still going");

  const files = await (await call("project-files", { projectId })).json().catch(() => ({}));
  const wrote = ["about.html", "contact.html", "pricing.html"].filter((n) => files?.files?.[n]);
  check(`all three pages were written (${wrote.join(", ") || "none"})`, wrote.length === 3, Object.keys(files?.files ?? {}));

  // ── 1. Did the project's own conventions reach the agent?
  const followed = wrote.filter((n) => String(files.files[n]).includes(marker));
  check(
    `the project's AGENTS.md was followed (${followed.length}/${wrote.length} pages carry the marker)`,
    followed.length > 0 && followed.length === wrote.length,
    { marker, sample: String(files?.files?.[wrote[0]] ?? "").slice(0, 300) },
  );

  // ── 2. Did the writes go out together?
  const { data: steps } = await admin
    .from("agent_tasks").select("tool_name,created_at")
    .eq("session_id", sessionId).eq("tool_name", "write").order("created_at", { ascending: true });
  const times = (steps ?? []).map((s) => new Date(s.created_at as string).getTime());
  const spread = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
  console.log(`      ${times.length} write steps, spread over ${spread}ms`);
  check(
    `the writes went out as one round, not one per step (${times.length} writes in ${spread}ms)`,
    times.length < 2 || spread < 5_000,
    { times, note: "sequential execution would space these by a model round trip each" },
  );
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
