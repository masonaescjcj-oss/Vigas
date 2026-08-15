import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectFilesSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { PROJECT_FILES_BUCKET, downloadBlob, listStorageFiles } from "../shared/storage.ts";

/** Text sources the preview can render. JSX/TS belong here: without them a
 * React project the agent wrote is invisible to the preview. */
const TEXT_FILE = /\.(html?|css|jsx?|tsx?|mjs|cjs|json|txt|md|svg)$/i;
const MAX_FILE_BYTES = 512_000;
const MAX_TOTAL_BYTES = 3_000_000;

/** Returns the text files of a project the caller owns — feeds the on-device
 * live preview. Binary and oversized files are skipped. */
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
