/**
 * evals/run-eval.ts
 * ---------------------------------------------------------------------------
 * Mini-eval harness: runs each scenario through the real edge runtime (same
 * code path as the queue worker, minus the queue) against a dedicated
 * "Eval Workspace" project, then scores results programmatically.
 *
 *   npx deno run --allow-all --env-file=.env evals/run-eval.ts [scenarioId ...]
 * ---------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { createEdgeAgentRuntime } from "../supabase/functions/shared/agentRuntime.ts";
import {
  PROJECT_FILES_BUCKET,
  downloadBlob,
  joinStoragePath,
  listStorageFiles,
  removeStoragePrefix,
  uploadBlob,
} from "../supabase/functions/shared/storage.ts";
import { templateContentType } from "../supabase/functions/shared/templates.ts";
import { SCENARIOS } from "./scenarios.ts";

const TEXT_FILE = /\.(html?|css|js|mjs|json|txt|md|svg)$/i;
const RUN_TIMEOUT_MS = 180_000;
const EVAL_PROJECT_NAME = "Eval Workspace";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(url, serviceKey);

async function ensureEvalProject(): Promise<{ userId: string; projectId: string; prefix: string }> {
  const { data: profile, error: pErr } = await client.from("profiles").select("id").limit(1).single();
  if (pErr || !profile) throw new Error("no profile found: " + pErr?.message);
  const userId = String(profile.id);

  const { data: existing } = await client
    .from("projects").select("id,sandbox_path")
    .eq("user_id", userId).eq("name", EVAL_PROJECT_NAME).maybeSingle();
  if (existing) return { userId, projectId: String(existing.id), prefix: String(existing.sandbox_path) };

  const projectId = crypto.randomUUID();
  const prefix = joinStoragePath("users", userId, "projects", projectId);
  await uploadBlob(client, PROJECT_FILES_BUCKET, joinStoragePath(prefix, ".keep"), "", "text/plain; charset=utf-8");
  const { error } = await client.from("projects").insert({
    id: projectId, user_id: userId, name: EVAL_PROJECT_NAME,
    description: "Automated agent-quality evals", sandbox_path: prefix,
  });
  if (error) throw error;
  return { userId, projectId, prefix };
}

async function resetWorkspace(prefix: string, seed: Record<string, string> = {}): Promise<void> {
  await removeStoragePrefix(client, PROJECT_FILES_BUCKET, prefix);
  await uploadBlob(client, PROJECT_FILES_BUCKET, joinStoragePath(prefix, ".keep"), "", "text/plain; charset=utf-8");
  for (const [path, contents] of Object.entries(seed)) {
    await uploadBlob(client, PROJECT_FILES_BUCKET, joinStoragePath(prefix, path), contents, templateContentType(path));
  }
}

async function readWorkspace(prefix: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const fullPath of await listStorageFiles(client, PROJECT_FILES_BUCKET, prefix)) {
    const rel = fullPath.slice(prefix.length + 1);
    if (!rel || rel === ".keep" || !TEXT_FILE.test(rel)) continue;
    files[rel] = await (await downloadBlob(client, PROJECT_FILES_BUCKET, fullPath)).text();
  }
  return files;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

const only = new Set(Deno.args);
const scenarios = only.size ? SCENARIOS.filter((s) => only.has(s.id)) : SCENARIOS;

const { userId, projectId, prefix } = await ensureEvalProject();
console.log(`eval project: ${projectId} (${scenarios.length} scenarios)\n`);

const results: Array<{ id: string; pass: boolean; reason?: string; ms: number; tokens: number; steps: number }> = [];

for (const scenario of scenarios) {
  const startedAt = performance.now();
  let pass = false, reason: string | undefined, tokens = 0, steps = 0;
  try {
    await resetWorkspace(prefix, scenario.seed);
    const runtime = await createEdgeAgentRuntime({
      client,
      user: { id: userId } as never,
      projectId,
      sandboxPath: prefix,
    });
    const result = await withTimeout(runtime.run(scenario.prompt, { title: `eval:${scenario.id}` }), RUN_TIMEOUT_MS);
    tokens = result.usage.inputTokens + result.usage.outputTokens;
    steps = result.usage.steps;
    const files = await readWorkspace(prefix);
    const failure = scenario.check(files, result.finalText ?? "");
    pass = failure === null;
    reason = failure ?? undefined;
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e);
  }
  const ms = Math.round(performance.now() - startedAt);
  results.push({ id: scenario.id, pass, reason, ms, tokens, steps });
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${scenario.id.padEnd(24)} ${String(ms).padStart(6)}ms  steps:${steps}  tokens:${tokens}` +
    (reason ? `\n      reason: ${reason.slice(0, 140)}` : ""),
  );
}

const passed = results.filter((r) => r.pass).length;
const totalTokens = results.reduce((s, r) => s + r.tokens, 0);
console.log(`\nSUMMARY: ${passed}/${results.length} passed | total tokens: ${totalTokens}`);
await Deno.writeTextFile("evals/last-results.json", JSON.stringify({ passed, total: results.length, totalTokens, results }, null, 2));
Deno.exit(passed === results.length ? 0 : 1);
