import { withSentryHandler } from "../shared/sentry.ts";
import { AgentForkSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner, createEdgeAgentRuntime } from "../shared/agentRuntime.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, AgentForkSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "agent-fork", user.id, 20);
    const { data: source, error } = await service.from("agent_sessions").select("project_id,profile,status,transcript").eq("id", input.sessionId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!source) throw new AppError(404, "SESSION_NOT_FOUND", "Session was not found.");
    const project = await assertProjectOwner(service, user.id, String(source.project_id));
    const messages = Array.isArray(source.transcript) ? source.transcript : [];
    if (input.atMessageIndex >= messages.length) throw new AppError(400, "MESSAGE_INDEX_OUT_OF_RANGE", `atMessageIndex must be between 0 and ${Math.max(0, messages.length - 1)}.`);
    const runtime = createEdgeAgentRuntime({ client: service, user, projectId: String(source.project_id), sandboxPath: project.sandbox_path, profile: source.profile === "readonly" ? "readonly" : "standard" });
    const forked = await runtime.forkSession(input.sessionId, input.atMessageIndex);
    return json({ session: forked }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("agent-fork", handler));
}
