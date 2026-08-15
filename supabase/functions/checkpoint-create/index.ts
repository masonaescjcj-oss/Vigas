/**
 * supabase/functions/checkpoint-create/index.ts
 * ---------------------------------------------------------------------------
 * Snapshot a project on demand ("save a restore point before I try this").
 *
 * The worker snapshots automatically before every run that can write, calling
 * shared/checkpoints.ts directly rather than coming through here.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { CheckpointCreateSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner } from "../shared/agentRuntime.ts";
import { createCheckpoint } from "../shared/checkpoints.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, CheckpointCreateSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "checkpoint-create", user.id, 30, 60);
    const project = await assertProjectOwner(service, user.id, input.projectId);

    const result = await createCheckpoint(service, {
      projectId: input.projectId,
      sandboxPath: project.sandbox_path,
      sessionId: input.sessionId ?? null,
    });

    // Nothing to snapshot is not an error the caller should have to catch — it
    // is a fact about the project, reported as one.
    if (!result.created) {
      return json({ checkpoint: null, skipped: result.reason, detail: result.detail }, 200, headers);
    }
    return json({ checkpoint: result.checkpoint, file_count: result.fileCount }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("checkpoint-create", handler));
}
