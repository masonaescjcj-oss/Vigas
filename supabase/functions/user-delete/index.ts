import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { EmptyInputSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { CHECKPOINTS_BUCKET, PROJECT_FILES_BUCKET, removeStoragePrefix } from "../shared/storage.ts";

/**
 * Permanently deletes the authenticated user: their Storage objects first, then
 * the auth user (DB rows cascade from auth.users). App Store and Play Store both
 * require an in-app account-deletion path, and the client previously claimed
 * success while calling a function that did not exist.
 */
export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    await parseJson(req, EmptyInputSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "user-delete", user.id, 3, 3_600);

    // 1. Remove every stored file this user owns (Storage has no cascade).
    const prefix = `users/${user.id}`;
    for (const bucket of [PROJECT_FILES_BUCKET, CHECKPOINTS_BUCKET]) {
      await removeStoragePrefix(service, bucket, prefix).catch(() => undefined);
    }

    // 2. Delete the auth user. profiles/projects/sessions cascade from here.
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return json({ deleted: true }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("user-delete", handler));
}
