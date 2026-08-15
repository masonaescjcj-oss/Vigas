import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { CheckpointRestoreSchema } from "../shared/zodSchemas.ts";
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
    const input = await parseJson(req, CheckpointRestoreSchema);
    await enforceRateLimit(service, "checkpoint-restore", clientIp(req), 20);
    const { data: checkpoint, error: checkpointError } = await service.from("checkpoints").select("id,project_id,snapshot_path").eq("id", input.checkpointId).maybeSingle();
    if (checkpointError) throw checkpointError;
    if (!checkpoint) throw new AppError(404, "CHECKPOINT_NOT_FOUND", "Checkpoint was not found.");
    const { data: project, error: projectError } = await service.from("projects").select("sandbox_path").eq("id", checkpoint.project_id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");
    const snapshotFiles = await storageFileMap(service, CHECKPOINTS_BUCKET, checkpoint.snapshot_path);
    const files = snapshotFiles.filter((file) => !file.path.endsWith("/.manifest.json"));
    await removeStoragePrefix(service, PROJECT_FILES_BUCKET, project.sandbox_path);
    for (const file of files) {
      const relative = file.path.slice(checkpoint.snapshot_path.length + 1);
      await uploadBlob(service, PROJECT_FILES_BUCKET, joinStoragePath(project.sandbox_path, relative), file.data, file.data.type || "application/octet-stream");
    }
    return json({ restored: true, checkpoint_id: checkpoint.id, project_id: checkpoint.project_id, files_restored: files.length }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("checkpoint-restore", handler));
}
