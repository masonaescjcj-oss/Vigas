/**
 * scripts/check-not-a-website.ts
 * ---------------------------------------------------------------------------
 * Does the agent build what was asked, or what the product knows how to show?
 *
 * Everything the agent is told points at the web: Preview renders a page, the
 * starter templates are all HTML, the delivery instructions name index.html.
 * The worry is that a request for something else — a Python trading bot, a CLI,
 * a library — comes back as a React app anyway, because that is the shape the
 * surrounding system rewards.
 *
 * Deliberately small: a bot is a few files, so this costs little and answers
 * the question exactly.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-not-a-website.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

const RUN_TIMEOUT_MS = 600_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `bot-${stamp}@example.com`;
  const password = `Bo-${crypto.randomUUID()}`;
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

  // The template the app itself uses when someone starts typing without picking
  // a project. That is the path a real user takes, and it is where the bias
  // lived: seeded with a landing page, the agent built onto a web project.
  const IMPLICIT_TEMPLATE = Deno.env.get("CHECK_TEMPLATE") ?? "blank";
  console.log(`      implicit project template: ${IMPLICIT_TEMPLATE}
`);
  const createProject = await call("projects-create", { name: `Bot ${stamp}`, template: IMPLICIT_TEMPLATE });
  const projectId = (await createProject.json().catch(() => ({})))?.project?.id;
  if (!projectId) throw new Error("no project id came back.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  const prompt =
    "Write me a Python crypto trading bot. It should read prices from an exchange API, " +
    "run a simple moving-average crossover strategy, and log its trades to a file. " +
    "Command line only — I do not want a website.";

  let sessionId: string | undefined;
  let round = 0;
  let finalText = "";

  // Answer whatever it asks, up to a few rounds, so the test measures what gets
  // built rather than stopping at the first question.
  let nextPrompt = prompt;
  while (round < 4) {
    round += 1;
    const run = await call("agent-run", { projectId, prompt: nextPrompt, ...(sessionId ? { sessionId } : {}) });
    const body = await run.json().catch(() => ({}));
    sessionId = body?.session_id ?? sessionId;
    if (!sessionId) throw new Error(`no session id: ${JSON.stringify(body).slice(0, 200)}`);

    const seen = new Set<string>();
    const { data: before } = await admin
      .from("agent_tasks").select("id").eq("session_id", sessionId).eq("tool_name", "agent-run")
      .in("status", ["success", "failed"]);
    for (const r of before ?? []) seen.add(r.id as string);

    const started = Date.now();
    let leg: { status: string; output: Record<string, unknown> } | null = null;
    while (Date.now() - started < RUN_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      const { data: rows } = await admin
        .from("agent_tasks").select("id,tool_name,status,tool_output")
        .eq("session_id", sessionId).order("created_at", { ascending: true });
      const fresh = (rows ?? []).filter((r) =>
        r.tool_name === "agent-run" && ["success", "failed"].includes(r.status) && !seen.has(r.id as string));
      const done = fresh.find((r) => (r.tool_output as Record<string, unknown>)?.continued !== true);
      if (done) {
        leg = { status: done.status as string, output: (done.tool_output ?? {}) as Record<string, unknown> };
        break;
      }
      console.log(`      round ${round}: ${Math.round((Date.now() - started) / 1000)}s — ${(rows ?? []).length} steps`);
    }
    if (!leg) throw new Error("timed out waiting for the run");

    finalText = String(leg.output.final_text ?? leg.output.error ?? "");
    const pending = leg.output.pending_question as
      | { questions: Array<{ header: string; question: string; options?: Array<{ label: string }> }> }
      | null;

    if (!pending?.questions?.length) {
      console.log(`\n      finished after ${round} round(s)\n`);
      break;
    }
    console.log(`\n      round ${round} — asked ${pending.questions.length}:`);
    for (const q of pending.questions) console.log(`        ${q.header}: ${q.question}`);
    nextPrompt =
      "Answers to your questions:\n" +
      pending.questions.map((q) => `- ${q.header}: ${q.options?.[0]?.label ?? "(skipped — decide for me)"}`).join("\n") +
      "\n\nGo ahead and build it.";
  }

  // ── What came out.
  const { data: projectRow } = await admin
    .from("projects").select("sandbox_path").eq("id", projectId).maybeSingle();

  async function walk(prefix: string, depth = 0): Promise<string[]> {
    const { data } = await admin.storage.from("project-files").list(prefix, { limit: 200 });
    const out: string[] = [];
    for (const entry of data ?? []) {
      const full = `${prefix}/${entry.name}`;
      if (entry.id === null) { if (depth < 4) out.push(...await walk(full, depth + 1)); }
      else out.push(full);
    }
    return out;
  }

  const base = (projectRow?.sandbox_path ?? "").length + 1;
  const paths = (projectRow ? await walk(projectRow.sandbox_path) : [])
    .filter((p) => p.slice(base) !== ".keep");
  const files: Record<string, string> = {};
  for (const path of paths) {
    const { data: blob } = await admin.storage.from("project-files").download(path);
    files[path.slice(base)] = blob ? await blob.text() : "";
  }
  const names = Object.keys(files).sort();

  console.log(`      ── ${names.length} files ──`);
  for (const n of names) console.log(`      ${n}`);
  console.log("");

  const python = names.filter((n) => n.endsWith(".py"));
  const web = names.filter((n) => /\.(html|jsx|tsx)$/.test(n));

  check(`it wrote Python (${python.join(", ") || "none"})`, python.length > 0, names);
  check(`it did not build a website instead (${web.join(", ") || "none"})`, web.length === 0, {
    web,
    hint: "a command-line bot was asked for, explicitly not a site",
  });
  // A dependency file only if it took dependencies. The first run of this check
  // failed here against a bot the agent had deliberately written against the
  // standard library — which needs no requirements.txt, and saying otherwise
  // would have pushed it to invent one.
  const declaresDeps = names.some((n) => /requirements\.txt|pyproject\.toml|Pipfile/.test(n));
  const importsThirdParty = /^\s*(import|from)\s+(ccxt|requests|pandas|numpy|websockets|aiohttp)\b/m
    .test(python.map((f) => files[f] ?? "").join("\n"));
  check(
    importsThirdParty
      ? `third-party imports are declared (${declaresDeps ? "yes" : "no"})`
      : "no dependency file needed — it uses the standard library",
    !importsThirdParty || declaresDeps,
    { importsThirdParty, declaresDeps, names },
  );

  check("it explains how to run it", names.some((n) => /readme/i.test(n)), names);

  console.log(`\n      final message (${finalText.length} chars):`);
  console.log(`      ${finalText.slice(0, 500).replace(/\n/g, "\n      ")}\n`);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
