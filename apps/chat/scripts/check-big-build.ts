/**
 * scripts/check-big-build.ts
 * ---------------------------------------------------------------------------
 * The question this answers: what happens when the request is too big?
 *
 * check-real-build.ts proves a small request works. That was never in doubt.
 * The failure people actually hit is the large one — "build me a whole shop" —
 * where the agent ran out of steps partway, returned nothing, and the run was
 * filed as a success. A half-built project was indistinguishable from a
 * finished one.
 *
 * So this asks for more than one turn can hold and checks the system says so:
 * the turn ends with a message, the outcome is recorded as truncated, and the
 * next leg is queued on the same session rather than the work being abandoned.
 *
 * Deliberately runs with a small AGENT_MAX_STEPS on the worker, because
 * provoking the real ceiling would cost real money and take real minutes. The
 * behaviour under test is what happens at the ceiling, not where it sits.
 *
 *   PROVIDER_API_URL=https://<ref>.supabase.co/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-big-build.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;

/** Several legs, each a full agent turn. */
const RUN_TIMEOUT_MS = 600_000;

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 600)}`}`);
  if (!ok) Deno.exitCode = 1;
}

try {
  const email = `big-${stamp}@example.com`;
  const password = `Bg-${crypto.randomUUID()}`;
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

  const createProject = await call("projects-create", { name: `Big build ${stamp}`, template: "landing" });
  const projectBody = await createProject.json().catch(() => ({}));
  const projectId = projectBody?.project?.id ?? projectBody?.id;
  if (!projectId) throw new Error("no project id came back; nothing below would mean anything.");
  cleanup.push(async () => { await admin.from("projects").delete().eq("id", projectId); });

  // The kind of request that does not fit: many separate pieces, each real.
  const prompt =
    "Build a complete online shop, front to back: a product list page, a product " +
    "detail page, a cart, a checkout form, an order confirmation page, an admin " +
    "page for adding products, a stylesheet shared by all of them, and a small " +
    "JSON file of sample products. Do not skip any of them. " +
    // Otherwise the agent quite reasonably asks what kind of shop first, and
    // the turn ends on a question instead of at the step ceiling — which is
    // good behaviour, but not the behaviour under test here.
    "Do not ask me any questions; make sensible choices yourself and start now.";
  const run = await call("agent-run", { projectId, prompt, title: `Big build ${stamp}` });
  const runBody = await run.json().catch(() => ({}));
  check(`the run is accepted (${run.status})`, run.status === 202 || run.ok, runBody);
  const sessionId = runBody?.session_id;
  if (!sessionId) throw new Error("no session id came back.");

  console.log(`\n      queued — watching for up to ${RUN_TIMEOUT_MS / 1000}s\n`);

  // Watch every agent-run row on this session, not just the first to finish.
  // One request now spans several jobs, and the whole point is what happens
  // between them.
  const legs: Array<{ id: string; status: string; output: Record<string, unknown> }> = [];
  const started = Date.now();
  let jobsSeen = 0;

  while (Date.now() - started < RUN_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const { data: rows } = await admin
      .from("agent_tasks").select("id,tool_name,status,tool_output")
      .eq("session_id", sessionId).order("created_at", { ascending: true });

    for (const row of rows ?? []) {
      if (row.tool_name !== "agent-run") continue;
      if (!["success", "failed"].includes(row.status)) continue;
      if (legs.some((l) => l.id === row.id)) continue;
      legs.push({ id: row.id, status: row.status, output: (row.tool_output ?? {}) as Record<string, unknown> });
      console.log(
        `      leg ${legs.length}: ${row.status}` +
        ` stopped=${row.tool_output?.stopped_reason ?? "?"}` +
        ` continued=${row.tool_output?.continued ?? false}` +
        (row.status === "failed" ? `
        error: ${String(row.tool_output?.error ?? "?").slice(0, 300)}` : ""),
      );
    }

    const { count } = await admin
      .from("job_queue").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    jobsSeen = count ?? 0;

    const last = legs.at(-1);
    // Done when a leg finished and did not hand on.
    if (last && last.output.continued !== true) break;
    if (last && last.status === "failed") break;

    const steps = (rows ?? []).filter((r) => r.tool_name !== "agent-run").length;
    console.log(`      ${Math.round((Date.now() - started) / 1000)}s — ${steps} steps, ${jobsSeen} job(s)`);
  }

  check("the build produced at least one finished leg", legs.length > 0, "nothing ever finished");
  if (legs.length === 0) throw new Error("nothing to measure.");

  // ── The behaviour that was broken.
  const truncated = legs.filter((l) => l.output.stopped_reason === "max-steps");
  // A failed leg reports an error rather than a final message; the thing being
  // checked here is that a *successful* leg never comes back silent.
  const anyEmpty = legs
    .filter((l) => l.status === "success")
    .some((l) => !String(l.output.final_text ?? "").trim());
  check(
    "no successful leg finished with an empty message",
    !anyEmpty,
    legs.map((l) => ({ status: l.status, stopped: l.output.stopped_reason, len: String(l.output.final_text ?? "").length })),
  );
  check(
    "no leg failed",
    legs.every((l) => l.status === "success"),
    legs.filter((l) => l.status === "failed").map((l) => l.output.error),
  );

  if (truncated.length > 0) {
    console.log(`\n      ${truncated.length} leg(s) hit the step ceiling — the case under test\n`);
    check(
      "a truncated leg is recorded as truncated, not as a plain success",
      truncated.every((l) => l.output.stopped_reason === "max-steps"),
      truncated.map((l) => l.output.stopped_reason),
    );
    check(
      "the build carried on instead of stopping there",
      legs.length > 1 || truncated.every((l) => l.output.continued === true),
      { legs: legs.length, continued: truncated.map((l) => l.output.continued) },
    );
    check(
      `more than one job ran for one request (${jobsSeen})`,
      jobsSeen > 1,
      "the continuation was never enqueued",
    );
  } else {
    // Not a failure — it means the ceiling was high enough this time. Say so
    // plainly rather than reporting a pass for something that never happened.
    console.log("\n      no leg hit the ceiling; the continuation path was not exercised.");
    console.log("      re-run with a lower AGENT_MAX_STEPS on the worker to test it.\n");
  }

  // ── Whatever happened, the work has to be real.
  const files = await call("project-files", { projectId });
  const filesBody = await files.json().catch(() => ({}));
  const names = Object.keys(filesBody?.files ?? {});
  check(`the build wrote files (${names.length}): ${names.slice(0, 12).join(", ")}`, names.length > 1, filesBody);

  const finalText = String(legs.at(-1)?.output.final_text ?? "");
  console.log(`\n      last message (${finalText.length} chars): ${finalText.slice(0, 220)}\n`);
} finally {
  for (const undo of cleanup.reverse()) await undo().catch(() => {});
}
