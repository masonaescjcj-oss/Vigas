import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectCreateSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { PROJECT_FILES_BUCKET, joinStoragePath, uploadBlob, removeStoragePrefix } from "../shared/storage.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ProjectCreateSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "projects-create", user.id, 20);
    const projectId = crypto.randomUUID();
    const sandboxPath = joinStoragePath("users", user.id, "projects", projectId);
    await uploadBlob(service, PROJECT_FILES_BUCKET, joinStoragePath(sandboxPath, ".keep"), "", "text/plain; charset=utf-8");
    const { data, error } = await service.from("projects").insert({ id: projectId, user_id: user.id, name: input.name, description: input.description ?? null, sandbox_path: sandboxPath }).select("id,user_id,name,description,sandbox_path,last_opened_at,created_at,updated_at").single();
    if (error || !data) {
      await removeStoragePrefix(service, PROJECT_FILES_BUCKET, sandboxPath);
      throw error ?? new Error("Project insert returned no row.");
    }
    return json({ project: data }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("projects-create", handler));
}
