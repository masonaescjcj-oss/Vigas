/**
 * supabase/functions/project-export/index.ts
 * ---------------------------------------------------------------------------
 * Taking your project with you.
 *
 * Nobody builds anything they care about in a tool they cannot get their work out
 * of, so this is a trust feature more than a convenience one. It gives back
 * exactly what is in the project — every file, binary ones included, and nothing
 * generated. An export that quietly adds a README nobody wrote is not a copy of
 * your work.
 *
 * The zip lands in the existing project-files bucket under `users/<uid>/exports/`,
 * which is outside any project's sandbox prefix, so the agent can neither see nor
 * edit it. That also means this needs no migration and no new bucket.
 *
 * The link is signed and short-lived. A permanent public URL would turn every
 * export into an unlisted copy of someone's source code, indefinitely.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ProjectExportSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner } from "../shared/agentRuntime.ts";
import { PROJECT_FILES_BUCKET, downloadBlob, listStorageFiles } from "../shared/storage.ts";
import { createZip, type ZipEntry } from "../shared/zipStore.ts";

/** Matches the checkpoint caps: a project bigger than this is not a phone project. */
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/** Long enough to reach the browser or the share sheet, short enough not to leak. */
const LINK_TTL_SECONDS = 900;

/** Exports are disposable. Keeping every one would grow storage without limit. */
const KEEP_EXPORTS_PER_PROJECT = 3;

/** A file name that is safe on every platform and still recognisable. */
function safeFileName(name: string): string {
  const cleaned = name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "project";
}

/** Drop all but the newest exports of this project. */
async function pruneExports(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  projectId: string,
  keepPath: string,
): Promise<void> {
  try {
    const prefix = `users/${userId}/exports`;
    const paths = await listStorageFiles(service, PROJECT_FILES_BUCKET, prefix);
    const mine = paths
      .filter((path) => path.includes(projectId) && path !== keepPath)
      // The timestamp is in the name, so lexical order is chronological order.
      .sort()
      .reverse()
      .slice(KEEP_EXPORTS_PER_PROJECT - 1);
    if (mine.length > 0) await service.storage.from(PROJECT_FILES_BUCKET).remove(mine);
  } catch (error) {
    // Housekeeping. The export the user asked for already exists.
    console.error(`[project-export] prune failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ProjectExportSchema);
    const service = createServiceClient();
    // Reads and rewrites every file in the project, so it is limited harder than
    // a normal read.
    await enforceRateLimit(service, "project-export", user.id, 6, 60);

    const project = await assertProjectOwner(service, user.id, input.projectId);
    const prefix = String(project.sandbox_path).replace(/^\/+|\/+$/g, "");

    const paths = await listStorageFiles(service, PROJECT_FILES_BUCKET, prefix);
    const files = paths.filter((path) => {
      const relative = path.slice(prefix.length + 1);
      // `.keep` exists only so an empty folder survives in Storage; it is not
      // part of anyone's project.
      return relative && relative !== ".keep";
    });

    if (files.length === 0) {
      throw new AppError(400, "PROJECT_EMPTY", "There are no files to export yet.");
    }
    if (files.length > MAX_FILES) {
      throw new AppError(
        413,
        "PROJECT_TOO_LARGE",
        `This project has ${files.length} files, over the ${MAX_FILES} file limit for an export.`,
      );
    }

    const entries: ZipEntry[] = [];
    let total = 0;
    for (const path of files) {
      const blob = await downloadBlob(service, PROJECT_FILES_BUCKET, path);
      total += blob.size;
      if (total > MAX_TOTAL_BYTES) {
        throw new AppError(
          413,
          "PROJECT_TOO_LARGE",
          `This project is over the ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))} MB limit for an export.`,
        );
      }
      // arrayBuffer, not text: an export that mangles a PNG is not a copy of the
      // project.
      entries.push({
        path: path.slice(prefix.length + 1),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    const zip = await createZip(entries);

    // Timestamped so two exports never collide, and sortable so pruning can find
    // the oldest without reading metadata.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    // Read separately: the ownership check returns only what it needs to verify
    // ownership. A file named after the project beats one named after a uuid.
    const { data: named } = await service
      .from("projects").select("name").eq("id", input.projectId).maybeSingle();
    const name = `${safeFileName(String(named?.name ?? "project"))}-${stamp}.zip`;
    const objectPath = `users/${user.id}/exports/${input.projectId}/${name}`;

    const upload = await service.storage.from(PROJECT_FILES_BUCKET).upload(objectPath, zip, {
      upsert: true,
      contentType: "application/zip",
      cacheControl: "0",
    });
    if (upload.error) {
      throw new AppError(502, "EXPORT_UPLOAD_FAILED", `Could not store the export: ${upload.error.message}`);
    }

    const signed = await service.storage
      .from(PROJECT_FILES_BUCKET)
      .createSignedUrl(objectPath, LINK_TTL_SECONDS, { download: name });
    if (signed.error || !signed.data?.signedUrl) {
      throw new AppError(502, "EXPORT_LINK_FAILED", `Could not create a download link: ${signed.error?.message}`);
    }

    await pruneExports(service, user.id, input.projectId, objectPath);

    return json({
      url: signed.data.signedUrl,
      fileName: name,
      fileCount: entries.length,
      sizeBytes: zip.length,
      expiresInSeconds: LINK_TTL_SECONDS,
    }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("project-export", handler));
}
