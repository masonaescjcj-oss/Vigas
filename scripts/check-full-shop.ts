/**
 * scripts/check-full-shop.ts
 * ---------------------------------------------------------------------------
 * The request the product is actually for, asked the way a user asks it.
 *
 * No template, no hints, no "do not ask me questions": a blank project and one
 * sentence. Everything else has been proven a piece at a time — continuation,
 * parallel writes, conventions, the model. This asks whether the thing a person
 * would type produces something they can open.
 *
 * It reports rather than only asserts. A build that comes back with eight files
 * and no backend has failed in a specific way, and which way it failed is the
 * whole point of running it.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-full-shop.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

/** Several legs of a real build. */
const RUN_TIMEOUT_MS = 900_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];
let keepProject = false;

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `shop-${stamp}@example.com`;
  const password = `Sh-${crypto.randomUUID()}`;
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

  // Blank: no template, nothing seeded. Whatever appears, the agent wrote.
  const createProject = await call("projects-create", { name: `Shop ${stamp}`, template: "blank" });
  const projectBody = await createProject.json().catch(() => ({}));
  const projectId = projectBody?.project?.id ?? projectBody?.id;
  if (!projectId) throw new Error(`no project id: ${JSON.stringify(projectBody).slice(0, 300)}`);
  cleanup.push(async () => {
    if (keepProject) return;
    await admin.from("projects").delete().eq("id", projectId);
  });

  const seeded = await (await call("project-files", { projectId })).json().catch(() => ({}));
  check(
    `the project starts empty (${Object.keys(seeded?.files ?? {}).length} files)`,
    Object.keys(seeded?.files ?? {}).length === 0,
    Object.keys(seeded?.files ?? {}),
  );

  // Exactly what a person would type. No coaching.
  const prompt = "Build me a complete online shop with a backend — people can sign up, log in, browse products, add to cart and place an order that is saved.";
  const run = await call("agent-run", { projectId, prompt, title: `Shop ${stamp}` });
  const runBody = await run.json().catch(() => ({}));
  const sessionId = runBody?.session_id;
  if (!sessionId) throw new Error(`no session id: ${JSON.stringify(runBody).slice(0, 300)}`);
  console.log(`\n      building (up to ${RUN_TIMEOUT_MS / 1000}s) — project ${projectId}\n`);

  const legs: Array<{ id: string; status: string; output: Record<string, unknown> }> = [];
  const started = Date.now();
  let done = false;

  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const { data: rows } = await admin
      .from("agent_tasks").select("id,tool_name,status,tool_output")
      .eq("session_id", sessionId).order("created_at", { ascending: true });

    for (const row of rows ?? []) {
      if (row.tool_name !== "agent-run") continue;
      if (!["success", "failed"].includes(row.status)) continue;
      if (legs.some((l) => l.id === row.id)) continue;
      legs.push({ id: row.id, status: row.status, output: (row.tool_output ?? {}) as Record<string, unknown> });
      console.log(`      leg ${legs.length}: ${row.status} stopped=${row.tool_output?.stopped_reason ?? "?"} continued=${row.tool_output?.continued ?? false}`);
      if (row.status === "failed") console.log(`        error: ${String(row.tool_output?.error ?? "").slice(0, 240)}`);
    }

    const last = legs.at(-1);
    if (last && (last.status === "failed" || last.output.continued !== true)) { done = true; break; }

    const tools = (rows ?? []).filter((r) => r.tool_name !== "agent-run");
    console.log(`      ${Math.round((Date.now() - started) / 1000)}s — ${tools.length} steps`);
  }
  check("the build finished", done, "still running at the timeout");

  let lastLeg = legs.at(-1);
  let finalText = String(lastLeg?.output.final_text ?? "");

  // ── The agent asking first is intended behaviour. What matters is what
  //    happens after the answer — that is the path a real user takes, and the
  //    one nothing had ever exercised end to end.
  const pending = lastLeg?.output.pending_question as
    | { questions: Array<{ header: string; question: string; options?: Array<{ label: string }> }> }
    | null
    | undefined;

  if (pending?.questions?.length) {
    console.log(`\n      the agent asked ${pending.questions.length} question(s); answering as the app does\n`);
    for (const q of pending.questions) console.log(`      Q: ${q.header} — ${q.question}`);

    // The same string formatAnswers() builds, picking the first option for each
    // question the way someone tapping through would.
    const answerText =
      "Answers to your questions:\n" +
      pending.questions
        .map((q) => `- ${q.header}: ${q.options?.[0]?.label ?? "(skipped — decide for me)"}`)
        .join("\n") +
      "\n\nGo ahead and build it.";
    console.log(`\n      sending:\n      ${answerText.replace(/\n/g, "\n      ")}\n`);

    const cont = await call("agent-run", { projectId, prompt: answerText, sessionId });
    const contBody = await cont.json().catch(() => ({}));
    check(`the answer was accepted (${cont.status})`, cont.status === 202 || cont.ok, contBody);

    const resumed = Date.now();
    let finishedAfterAnswer = false;
    const seenBefore = new Set(legs.map((l) => l.id));
    while (Date.now() - resumed < RUN_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      const { data: rows } = await admin
        .from("agent_tasks").select("id,tool_name,status,tool_output")
        .eq("session_id", sessionId).order("created_at", { ascending: true });

      for (const row of rows ?? []) {
        if (row.tool_name !== "agent-run") continue;
        if (!["success", "failed"].includes(row.status)) continue;
        if (legs.some((l) => l.id === row.id)) continue;
        legs.push({ id: row.id, status: row.status, output: (row.tool_output ?? {}) as Record<string, unknown> });
        console.log(`      leg ${legs.length}: ${row.status} stopped=${row.tool_output?.stopped_reason ?? "?"} continued=${row.tool_output?.continued ?? false}`);
        if (row.status === "failed") console.log(`        error: ${String(row.tool_output?.error ?? "").slice(0, 240)}`);
      }

      const l = legs.at(-1);
      if (l && !seenBefore.has(l.id) && (l.status === "failed" || l.output.continued !== true)) {
        finishedAfterAnswer = true;
        break;
      }
      const tools = (rows ?? []).filter((r) => r.tool_name !== "agent-run");
      console.log(`      ${Math.round((Date.now() - resumed) / 1000)}s — ${tools.length} steps`);
    }
    check("the build ran to completion after the answer", finishedAfterAnswer, "stuck after answering");

    lastLeg = legs.at(-1);
    finalText = String(lastLeg?.output.final_text ?? "");
  }

  // ── What actually came out.
  const after = await (await call("project-files", { projectId })).json().catch(() => ({}));
  const files: Record<string, string> = after?.files ?? {};
  const names = Object.keys(files).sort();
  const all = Object.values(files).join("\n");

  console.log(`\n      ── ${names.length} files ──`);
  for (const n of names) console.log(`      ${n}  (${files[n].length} bytes)`);
  console.log("");

  check(`it produced files (${names.length})`, names.length > 0, "nothing was written");
  check("there is an index.html to open", names.includes("index.html"), names);

  // ── Is it actually a backend, or localStorage wearing a hat?
  const usesSupabase = /supabase/i.test(all);
  const usesLocalStorage = /localStorage/.test(all);
  const hasRlsSql = /row level security|enable row level security|create policy/i.test(all);
  const hasAuth = /signUp|signInWithPassword|signInWithOtp|auth\./i.test(all);

  console.log(`      supabase referenced : ${usesSupabase}`);
  console.log(`      auth calls          : ${hasAuth}`);
  console.log(`      RLS policy written  : ${hasRlsSql}`);
  console.log(`      localStorage used   : ${usesLocalStorage}`);
  console.log("");

  check("the shop has a real backend, not just localStorage", usesSupabase, {
    usesLocalStorage,
    hint: "a backend was asked for explicitly",
  });
  check("sign-up / sign-in is wired", hasAuth, "no auth calls found in any file");
  check("row level security was written, not skipped", hasRlsSql,
    "without it every table is readable by anyone who opens the page");

  // ── Would it open? The preview inlines local refs, so a page whose script
  //    and stylesheet are missing is a blank screen for the user.
  const html = files["index.html"] ?? "";
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith("data:") && !r.startsWith("#"));
  const missing = refs.filter((r) => !(r.replace(/^\.?\//, "") in files));
  check(
    `every local file index.html references exists${missing.length ? "" : ` (${refs.length} refs)`}`,
    missing.length === 0,
    { missing, have: names },
  );

  const secretLeak = /service_role|SUPABASE_SERVICE_ROLE|sk-[A-Za-z0-9]{20,}/.test(all);
  check("no service-role key or API key was put in the page", !secretLeak,
    "a secret in a static page is readable by every visitor");

  console.log(`\n      final message (${finalText.length} chars):`);
  console.log(`      ${finalText.slice(0, 700).replace(/\n/g, "\n      ")}\n`);

  if (Deno.exitCode !== 0) {
    keepProject = true;
    console.log(`      project kept for inspection: ${projectId}\n`);
  }
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
