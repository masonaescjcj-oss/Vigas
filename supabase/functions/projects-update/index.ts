import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectUpdateSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["PATCH"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ProjectUpdateSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "projects-update", user.id, 60);
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.description !== undefined) update.description = input.description;
    if (input.lastOpenedAt !== undefined) update.last_opened_at = input.lastOpenedAt;
    const { data, error } = await service.from("projects").update(update).eq("id", input.projectId).eq("user_id", user.id).select("id,user_id,name,description,sandbox_path,last_opened_at,created_at,updated_at").maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");
    return json({ project: data }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("projects-update", handler));
}
