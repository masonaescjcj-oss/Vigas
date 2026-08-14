import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { AgentRunSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
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
    const input = await parseJson(req, AgentRunSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "agent-run", user.id, 5, 60);
    const project = await assertProjectOwner(service, user.id, input.projectId);
    await checkUsage(service, user.id);
    let profile: "standard" | "readonly" = input.profile ?? "standard";
    if (input.sessionId) {
      const { data: existing, error } = await service.from("agent_sessions").select("project_id,profile,status").eq("id", input.sessionId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (existing && existing.project_id !== input.projectId) throw new Error("Session does not belong to this project.");
      if (existing?.status === "completed") throw new Error("Completed sessions cannot be reused; fork the session instead.");
      if (existing?.profile === "readonly" || existing?.profile === "standard") profile = existing.profile;
    }
    const sessionId = input.sessionId ?? crypto.randomUUID();
    await ensureSession(service, user.id, input.projectId, sessionId, profile, input.title);
    const { data: job, error } = await service.from("job_queue").insert({
      user_id: user.id,
      project_id: input.projectId,
      session_id: sessionId,
      payload: { mode: "run", prompt: input.prompt, profile, title: input.title ?? null, sandbox_path: project.sandbox_path },
    }).select("id,status,created_at").single();
    if (error || !job) throw error ?? new Error("Unable to enqueue agent job.");
    return json({ accepted: true, session_id: sessionId, job_id: job.id, status: job.status, created_at: job.created_at }, 202, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("agent-run", handler));
}
