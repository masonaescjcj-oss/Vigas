import { captureException, flushSentry, withSentryHandler, withSentrySpan } from "../shared/sentry.ts";
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

/**
 * Take the pre-run snapshot. Returns what the UI should say about it: an id to
 * roll back to, or the reason there isn't one. Never throws — a project that
 * cannot be snapshotted still gets to run, it just cannot be rolled back.
 */
async function snapshotBeforeRun(
  client: SupabaseClient,
  job: QueueJob,
): Promise<{ id: string | null; note: string | null }> {
  const sandboxPath = String(job.payload.sandbox_path ?? "");
  if (!sandboxPath) return { id: null, note: "no sandbox path on the job" };
  try {
    const { createCheckpoint } = await import("../shared/checkpoints.ts");
    const result = await createCheckpoint(client, {
      projectId: job.project_id,
      sandboxPath,
      sessionId: job.session_id,
    });
    return result.created
      ? { id: result.checkpoint.id, note: null }
      : { id: null, note: result.detail };
  } catch (error) {
    captureException(error, { function: "queue-worker", phase: "checkpoint" });
    return { id: null, note: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Tell the user their run finished.
 *
 * Deliberately after the job is already recorded as complete, and deliberately
 * unable to throw: the user asked for a build, not for a notification. A push
 * that fails must not turn a finished run into a retried one.
 */
async function notify(
  client: SupabaseClient,
  job: QueueJob,
  outcome: { succeeded: boolean; detail: string },
  durationMs: number,
): Promise<void> {
  try {
    const { notifyRunFinished } = await import("../shared/push.ts");
    const { data } = await client.from("projects").select("name").eq("id", job.project_id).maybeSingle();
    const result = await notifyRunFinished(client, job.user_id, {
      projectName: data?.name ? String(data.name) : null,
      sessionId: job.session_id,
      projectId: job.project_id,
      succeeded: outcome.succeeded,
      detail: outcome.detail,
    }, durationMs);
    // Logged either way: a worker that has quietly stopped notifying anyone is
    // otherwise invisible until a user complains.
    console.log(`[queue-worker] push for job ${job.id}: sent=${result.sent}${result.skipped ? ` (${result.skipped})` : ""}`);
  } catch (error) {
    captureException(error, { function: "queue-worker", phase: "push" });
  }
}

export async function processNextJob(client: SupabaseClient, workerId: string): Promise<{ processed: boolean; status?: string; jobId?: string }> {
  const job = await claim(client, workerId);
  if (!job) return { processed: false };
  await setTask(client, job.session_id, "running", { status: "processing", attempt: job.attempts });
  // Measured here rather than from locked_at: this is the wall-clock the user
  // actually waited, which is what decides whether a push is welcome or noise.
  const startedAt = Date.now();
  try {
    // Load the Agent Core lazily. This keeps the worker's authenticated health
    // path lightweight and prevents an optional sandbox SDK from becoming a
    // module-boot dependency when the queue is empty.
    const { createEdgeAgentRuntime, createEdgeSandboxManager } = await import("../shared/agentRuntime.ts");
    const { resolveProvider } = await import("../shared/resolveProvider.ts");
    // Read at run time, not from the job payload: the payload is a plain jsonb
    // column, and a decrypted key must never be written to one.
    const credentials = await resolveProvider(client, job.user_id);
    const payload = job.payload;
    const mode = payload.mode === "resume" ? "resume" : "run";
    const profile = payload.profile === "readonly" ? "readonly" : "standard";

    // Snapshot before the agent can touch anything. A readonly run cannot
    // change files, so it does not pay for one. A failure here must not block
    // the run — the user asked for work, not for a backup — but it is reported
    // so the UI never offers a rollback that does not exist.
    const checkpoint = profile === "readonly"
      ? { id: null as string | null, note: "readonly run — files cannot change" }
      : await snapshotBeforeRun(client, job);

    const sandboxManager = createEdgeSandboxManager(client);
    try {
      const runtime = createEdgeAgentRuntime({
        client,
        user: { id: job.user_id } as User,
        projectId: job.project_id,
        sandboxPath: String(payload.sandbox_path ?? ""),
        sessionId: job.session_id,
        profile,
        sandboxManager,
        model: typeof payload.model === "string" ? payload.model : undefined,
        credentials,
        skills: Array.isArray(payload.skills)
          ? payload.skills.filter((id): id is string => typeof id === "string")
          : [],
        backend: payload.backend && typeof payload.backend === "object"
          ? payload.backend as { url: string; anonKey: string }
          : null,
      });
      const result = await withSentrySpan("agent.execute", "agent.run", async () => await runtime.run(String(payload.prompt ?? ""), { sessionId: job.session_id, title: typeof payload.title === "string" ? payload.title : undefined }));
      await recordUsage(client, job.user_id, result.usage.inputTokens + result.usage.outputTokens);
      const { error } = await client.rpc("complete_agent_job", { p_job_id: job.id, p_result: { final_text: result.finalText, usage: result.usage, mode } });
      if (error) throw error;
      // checkpoint_id travels with the run's result so the chat can offer
      // "roll back to before this message" on the exact turn it belongs to.
      await setTask(client, job.session_id, "success", {
        final_text: result.finalText,
        usage: result.usage,
        checkpoint_id: checkpoint.id,
        checkpoint_note: checkpoint.note,
        // Present when the agent asked the user something rather than
        // finishing. The chat renders the options and sends the answer back as
        // the next turn on this same session, so nothing here has to wait.
        pending_question: result.pendingQuestion ?? null,
      });
      await notify(client, job, { succeeded: true, detail: result.finalText }, Date.now() - startedAt);
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
    // Only once it has genuinely given up. Notifying on each retry would buzz a
    // phone four times for one run that is still, as far as the user is
    // concerned, in progress.
    if (decision.status === "failed") {
      await notify(client, job, { succeeded: false, detail: message }, Date.now() - startedAt);
    }
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
