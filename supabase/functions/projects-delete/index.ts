import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectDeleteSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { PROJECT_FILES_BUCKET, removeStoragePrefix } from "../shared/storage.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["DELETE"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ProjectDeleteSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "projects-delete", user.id, 10);
    const { data: project, error: lookupError } = await service.from("projects").select("id,sandbox_path").eq("id", input.projectId).eq("user_id", user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");
    const expectedPath = `users/${user.id}/projects/${input.projectId}`;
    const storedPath = String(project.sandbox_path ?? "").replace(/^\/+|\/+$/g, "");
    if (storedPath !== expectedPath && !storedPath.startsWith(`${expectedPath}/`)) throw new AppError(409, "INVALID_PROJECT_SANDBOX", "The project sandbox path is invalid; contact support before deleting it.");
    await removeStoragePrefix(service, PROJECT_FILES_BUCKET, project.sandbox_path);
    const { error } = await service.from("projects").delete().eq("id", input.projectId).eq("user_id", user.id);
    if (error) throw error;
    return json({ deleted: true, project_id: input.projectId }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("projects-delete", handler));
}
