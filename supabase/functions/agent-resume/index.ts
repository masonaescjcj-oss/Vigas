import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { AgentResumeSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner, ensureSession } from "../shared/agentRuntime.ts";
import { checkUsage } from "../shared/usage.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, AgentResumeSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "agent-resume", user.id, 5, 60);
    const { data: session, error } = await service.from("agent_sessions").select("project_id,profile,status").eq("id", input.sessionId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!session) throw new AppError(404, "SESSION_NOT_FOUND", "Session was not found.");
    if (session.status === "completed") throw new AppError(409, "SESSION_COMPLETED", "Completed sessions cannot be resumed; fork it to continue from a new branch.");
    const project = await assertProjectOwner(service, user.id, String(session.project_id));
    await checkUsage(service, user.id);
    const profile = session.profile === "readonly" ? "readonly" : "standard";
    await ensureSession(service, user.id, String(session.project_id), input.sessionId, profile);
    const { data: job, error: enqueueError } = await service.from("job_queue").insert({
      user_id: user.id,
      project_id: String(session.project_id),
      session_id: input.sessionId,
      payload: { mode: "resume", prompt: input.prompt, profile, sandbox_path: project.sandbox_path },
    }).select("id,status,created_at").single();
    if (enqueueError || !job) throw enqueueError ?? new Error("Unable to enqueue resume job.");
    return json({ accepted: true, session_id: input.sessionId, job_id: job.id, status: job.status, created_at: job.created_at }, 202, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("agent-resume", handler));
}
