import { captureException, flushSentry, withSentryHandler, withSentrySpan } from "../../../src/infra/monitoring/sentryConfig.ts";
import { EmptyInputSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, constantTimeEqual, json, preflight } from "../shared/http.ts";
import { createServiceClient } from "../shared/supabase.ts";
import { recordUsage } from "../shared/usage.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { retryDecision, type QueueJob } from "../shared/queue.ts";
import type { SupabaseClient, User } from "@supabase/supabase-js";

function workerSecret(): string {
  const secret = Deno.env.get("QUEUE_WORKER_SECRET_V2") ?? Deno.env.get("QUEUE_WORKER_SECRET");
  if (!secret) throw new AppError(500, "SERVER_MISCONFIGURED", "QUEUE_WORKER_SECRET is not configured.");
  return secret;
}

export async function requireWorker(req: Request): Promise<void> {
  const actual = req.headers.get("authorization") ?? "";
  if (!await constantTimeEqual(actual, `Bearer ${workerSecret()}`)) throw new AppError(401, "UNAUTHORIZED", "Queue worker authorization is invalid.");
}

async function claim(client: SupabaseClient, workerId: string): Promise<QueueJob | null> {
  const { data, error } = await client.rpc("claim_next_agent_job", { p_worker_id: workerId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? row as QueueJob : null;
}

async function setTask(client: SupabaseClient, sessionId: string, status: "running" | "success" | "failed", output: Record<string, unknown>): Promise<void> {
  if (status === "running") {
    const { data: active } = await client.from("agent_tasks").select("id").eq("session_id", sessionId).eq("tool_name", "agent-run").eq("status", "running").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (active?.id) {
      const { error } = await client.from("agent_tasks").update({ tool_output: output }).eq("id", active.id);
      if (error) throw error;
      return;
    }
    const { error } = await client.from("agent_tasks").insert({ session_id: sessionId, tool_name: "agent-run", tool_input: { queued: true }, status, tool_output: output });
    if (error) throw error;
    return;
  }
  const { data } = await client.from("agent_tasks").select("id").eq("session_id", sessionId).eq("tool_name", "agent-run").eq("status", "running").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data?.id) await client.from("agent_tasks").update({ status, tool_output: output }).eq("id", data.id);
}

export async function processNextJob(client: SupabaseClient, workerId: string): Promise<{ processed: boolean; status?: string; jobId?: string }> {
  const job = await claim(client, workerId);
  if (!job) return { processed: false };
  await setTask(client, job.session_id, "running", { status: "processing", attempt: job.attempts });
  try {
    // Load the Agent Core lazily. This keeps the worker's authenticated health
    // path lightweight and prevents an optional sandbox SDK from becoming a
    // module-boot dependency when the queue is empty.
    const { createEdgeAgentRuntime, createEdgeSandboxManager } = await import("../shared/agentRuntime.ts");
    const payload = job.payload;
    const mode = payload.mode === "resume" ? "resume" : "run";
    const sandboxManager = createEdgeSandboxManager(client);
    try {
      const runtime = createEdgeAgentRuntime({
        client,
        user: { id: job.user_id } as User,
        projectId: job.project_id,
        sandboxPath: String(payload.sandbox_path ?? ""),
        sessionId: job.session_id,
        profile: payload.profile === "readonly" ? "readonly" : "standard",
        sandboxManager,
        model: typeof payload.model === "string" ? payload.model : undefined,
      });
      const result = await withSentrySpan("agent.execute", "agent.run", async () => await runtime.run(String(payload.prompt ?? ""), { sessionId: job.session_id, title: typeof payload.title === "string" ? payload.title : undefined }));
      await recordUsage(client, job.user_id, result.usage.inputTokens + result.usage.outputTokens);
      const { error } = await client.rpc("complete_agent_job", { p_job_id: job.id, p_result: { final_text: result.finalText, usage: result.usage, mode } });
      if (error) throw error;
      await setTask(client, job.session_id, "success", { final_text: result.finalText, usage: result.usage });
      return { processed: true, status: "completed", jobId: job.id };
    } finally {
      // Cost control: never leave a sandbox warm after the job — idle warm time
      // is billed the same as work. The next job simply reacquires one.
      await sandboxManager.destroySession(job.session_id).catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const decision = retryDecision(job.attempts);
    const { error: failError } = await client.rpc("fail_agent_job", { p_job_id: job.id, p_error: message });
    if (failError) throw failError;
    await setTask(client, job.session_id, decision.status === "failed" ? "failed" : "running", { error: message, retry_in_seconds: decision.delaySeconds, attempts: job.attempts });
    return { processed: true, status: decision.status, jobId: job.id };
  }
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    await requireWorker(req);
    await parseJson(req, EmptyInputSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "queue-worker", "cron-worker", 30, 60);
    const task = processNextJob(service, `edge-worker:${crypto.randomUUID()}`).catch(async (error) => {
      captureException(error, { function: "queue-worker", phase: "background" });
      await flushSentry();
    });
    const edgeRuntime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime;
    if (edgeRuntime) {
      edgeRuntime.waitUntil(task);
      return json({ accepted: true }, 202, headers);
    }
    await task;
    return json({ accepted: true }, 202, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("queue-worker", handler));
}
