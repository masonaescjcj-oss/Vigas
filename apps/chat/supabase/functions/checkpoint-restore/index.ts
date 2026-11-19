/**
 * supabase/functions/checkpoint-restore/index.ts
 * ---------------------------------------------------------------------------
 * Roll a project back to a snapshot.
 *
 * This used to require the service role, which meant no client could ever call
 * it — the rollback buttons in the app had nowhere to go. It is the project
 * owner's own data, so it is authenticated as the owner and ownership is
 * checked against the checkpoint's project. The heavy lifting (manifest
 * verification, the safety snapshot, the swap) lives in shared/checkpoints.ts.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { CheckpointRestoreSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { restoreCheckpoint } from "../shared/checkpoints.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, CheckpointRestoreSchema);
    const service = createServiceClient();
    // Rollback destroys the current working files, so it is rate limited harder
    // than a read and a misfire cannot be repeated in a loop.
    await enforceRateLimit(service, "checkpoint-restore", user.id, 10, 60);

    // Ownership is checked through the checkpoint's project — a checkpoint id
    // alone must never be enough to overwrite someone else's files. Two
    // queries rather than an embed: PostgREST returns an embedded row as an
    // object or a one-element array depending on how it resolves the
    // relationship, and getting that wrong here would deny the real owner.
    const { data: checkpoint, error } = await service
      .from("checkpoints")
      .select("id,project_id")
      .eq("id", input.checkpointId)
      .maybeSingle();
    if (error) throw error;
    if (!checkpoint) throw new AppError(404, "CHECKPOINT_NOT_FOUND", "Checkpoint was not found.");

    const { data: owned, error: ownerError } = await service
      .from("projects")
      .select("id")
      .eq("id", checkpoint.project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownerError) throw ownerError;
    // Same 404 either way: a stranger must not learn that the id is real.
    if (!owned) throw new AppError(404, "CHECKPOINT_NOT_FOUND", "Checkpoint was not found.");

    const result = await restoreCheckpoint(service, input.checkpointId);
    return json(
      {
        restored: true,
        checkpoint_id: result.checkpointId,
        project_id: result.projectId,
        files_restored: result.filesRestored,
        // The caller can offer "undo this rollback" with this id.
        safety_checkpoint_id: result.safetyCheckpointId,
      },
      200,
      headers,
    );
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("checkpoint-restore", handler));
}
