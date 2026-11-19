import { withSentryHandler } from "../shared/sentry.ts";
import { ProjectFilesSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { PROJECT_FILES_BUCKET, downloadBlob, joinStoragePath, listStorageFiles, uploadBlob } from "../shared/storage.ts";

/** Text sources the preview can render. JSX/TS belong here: without them a
 * React project the agent wrote is invisible to the preview. */
const TEXT_FILE = /\.(html?|css|jsx?|tsx?|mjs|cjs|json|txt|md|svg)$/i;
const MAX_FILE_BYTES = 512_000;
const MAX_TOTAL_BYTES = 3_000_000;

/**
 * Reads and edits a project's text files.
 *
 * Without an `action` it returns every text file — the bundle the on-device
 * preview renders. With one it writes, deletes or renames a single file, which
 * is how the file viewer and file tree change anything: the client has no
 * direct access to the Storage objects.
 */
export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ProjectFilesSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "project-files", user.id, 30, 60);

    const { data: project, error } = await service
      .from("projects")
      .select("id,sandbox_path")
      .eq("id", input.projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");

    const prefix = String(project.sandbox_path ?? "").replace(/^\/+|\/+$/g, "");

    // Storage RLS gives the client no access to these objects at all — reads
    // come back empty and writes are refused — so editing a file has to go
    // through here, where ownership has just been proven.
    if (input.action) {
      const target = joinStoragePath(prefix, input.path!);
      if (input.action === "write") {
        if (!TEXT_FILE.test(input.path!)) {
          throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "Only text project files can be edited here.");
        }
        await uploadBlob(service, PROJECT_FILES_BUCKET, target, input.content!, "text/plain");
        return json({ ok: true, path: input.path }, 200, headers);
      }
      if (input.action === "delete") {
        const { error: removeError } = await service.storage.from(PROJECT_FILES_BUCKET).remove([target]);
        if (removeError) throw new AppError(500, "STORAGE_ERROR", removeError.message);
        return json({ ok: true, path: input.path }, 200, headers);
      }
      // rename
      const destination = joinStoragePath(prefix, input.toPath!);
      const { error: moveError } = await service.storage
        .from(PROJECT_FILES_BUCKET)
        .move(target, destination);
      if (moveError) throw new AppError(409, "RENAME_FAILED", moveError.message);
      return json({ ok: true, path: input.toPath }, 200, headers);
    }

    const paths = await listStorageFiles(service, PROJECT_FILES_BUCKET, prefix);
    const files: Record<string, string> = {};
    let total = 0;
    for (const fullPath of paths) {
      const rel = fullPath.slice(prefix.length + 1);
      if (!rel || rel === ".keep" || !TEXT_FILE.test(rel)) continue;
      const blob = await downloadBlob(service, PROJECT_FILES_BUCKET, fullPath);
      if (blob.size > MAX_FILE_BYTES) continue;
      total += blob.size;
      if (total > MAX_TOTAL_BYTES) break;
      files[rel] = await blob.text();
    }
    return json({ files }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("project-files", handler));
}
