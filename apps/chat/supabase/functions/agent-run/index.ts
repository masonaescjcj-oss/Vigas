import { withSentryHandler } from "../shared/sentry.ts";
import { AgentRunSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner, ensureSession, resolveRequestedModel } from "../shared/agentRuntime.ts";
import { tierOf } from "../shared/usage.ts";
import { enforceQuota, planQuota, recordQuotaEvent } from "../shared/quota.ts";

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
    // A build occupies a worker and a sandbox, which we pay for however the
    // model was billed — so this limit applies even with the user's own key.
    //
    // Counted here rather than from job_queue because a large build hands
    // itself on to continuation jobs: counting rows would charge someone four
    // builds for asking once. This endpoint is only ever called by a person.
    const tier = await tierOf(service, user.id);
    const quota = await planQuota(service, tier);
    await enforceQuota(service, user.id, "build", quota);
    // Resolved here, not in the worker: a model the caller may not use has to
    // be refused while there is still a request to answer, so the app can send
    // them to the paywall instead of surfacing a failed run minutes later.
    const model = await resolveRequestedModel(service, input.model, tier);
    let profile: "standard" | "readonly" = input.profile ?? "standard";
    if (input.sessionId) {
      const { data: existing, error } = await service.from("agent_sessions").select("project_id,profile,status").eq("id", input.sessionId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (existing && existing.project_id !== input.projectId) {
        throw new AppError(409, "SESSION_PROJECT_MISMATCH", "This session belongs to a different project.");
      }
      // A finished turn leaves the session "completed"; a follow-up message in
      // the same chat must be able to continue it (the runtime reactivates it
      // on load). Only an archived session is terminal.
      if (existing?.status === "archived") {
        throw new AppError(409, "SESSION_ARCHIVED", "This session is archived; start a new chat or fork it.");
      }
      if (existing?.profile === "readonly" || existing?.profile === "standard") profile = existing.profile;
    }
    const sessionId = input.sessionId ?? crypto.randomUUID();
    await ensureSession(service, user.id, input.projectId, sessionId, profile, input.title);
    const { data: job, error } = await service.from("job_queue").insert({
      user_id: user.id,
      project_id: input.projectId,
      session_id: sessionId,
      payload: {
        mode: "run",
        prompt: input.prompt,
        profile,
        title: input.title ?? null,
        sandbox_path: project.sandbox_path,
        // Unknown/"auto" model ids resolve to undefined so the worker uses the
        // server default instead of trusting client input.
        model: model ?? null,
        // Ids only. The prompt text is resolved from the catalog in the worker, so
        // a job row never carries instructions a client supplied.
        skills: input.skills ?? [],
        // Public values only, so a job row carries nothing secret.
        backend: input.backend ?? null,
      },
    }).select("id,status,created_at").single();
    if (error?.code === "23505" || error?.code === "23P01" || /duplicate key|unique/i.test(error?.message ?? "")) {
      throw new AppError(409, "AGENT_BUSY", "This chat already has a run in progress — wait for it to finish.");
    }
    if (error || !job) throw error ?? new Error("Unable to enqueue agent job.");

    // After the job is safely queued, so a run that was refused — for a busy
    // chat, a bad project, anything above — is not charged to the allowance
    // that refused it.
    await recordQuotaEvent(service, user.id, "build");

    return json({ accepted: true, session_id: sessionId, job_id: job.id, status: job.status, created_at: job.created_at }, 202, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("agent-run", handler));
}
