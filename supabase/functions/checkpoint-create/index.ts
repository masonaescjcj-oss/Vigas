import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { CheckpointCreateSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight, clientIp } from "../shared/http.ts";
import { createServiceClient, requireServiceRole } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { CHECKPOINTS_BUCKET, PROJECT_FILES_BUCKET, joinStoragePath, storageFileMap, uploadBlob, removeStoragePrefix } from "../shared/storage.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const service = await requireServiceRole(req);
    const input = await parseJson(req, CheckpointCreateSchema);
    await enforceRateLimit(service, "checkpoint-create", clientIp(req), 30);
    const { data: project, error: projectError } = await service.from("projects").select("id,sandbox_path").eq("id", input.projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");
    const checkpointId = crypto.randomUUID();
    const snapshotPath = joinStoragePath("projects", input.projectId, checkpointId);
    try {
      const files = await storageFileMap(service, PROJECT_FILES_BUCKET, project.sandbox_path);
      const manifest: string[] = [];
      const prefixLength = project.sandbox_path.length + 1;
      for (const file of files) {
        const relative = file.path.startsWith(`${project.sandbox_path}/`) ? file.path.slice(prefixLength) : file.path;
        const target = joinStoragePath(snapshotPath, relative);
        await uploadBlob(service, CHECKPOINTS_BUCKET, target, file.data, file.data.type || "application/octet-stream");
        manifest.push(relative);
      }
      await uploadBlob(service, CHECKPOINTS_BUCKET, joinStoragePath(snapshotPath, ".manifest.json"), JSON.stringify({ project_id: input.projectId, files: manifest, created_at: new Date().toISOString() }), "application/json");
      const { data: checkpoint, error } = await service.from("checkpoints").insert({ id: checkpointId, project_id: input.projectId, session_id: input.sessionId ?? null, snapshot_path: snapshotPath }).select("id,project_id,session_id,snapshot_path,created_at").single();
      if (error || !checkpoint) throw error ?? new Error("Checkpoint insert returned no row.");
      return json({ checkpoint }, 201, headers);
    } catch (error) {
      await removeStoragePrefix(service, CHECKPOINTS_BUCKET, snapshotPath).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("checkpoint-create", handler));
}
