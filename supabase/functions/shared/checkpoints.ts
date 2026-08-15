/**
 * supabase/functions/shared/checkpoints.ts
 * ---------------------------------------------------------------------------
 * Snapshot and rollback for a project's files.
 *
 * The logic lives here rather than inside the checkpoint-* endpoints because
 * the worker needs to snapshot in-process: it already holds a service client,
 * and an HTTP hop to itself before every run would add latency and a second
 * failure mode to the one path that must not fail silently.
 *
 * Two rules shape the design:
 *
 *   1. Restore deletes the project's files before writing the snapshot back, so
 *      a snapshot that is missing files is worse than no snapshot at all. Every
 *      snapshot records a manifest, and restore refuses to run unless what is
 *      in Storage matches it exactly.
 *
 *   2. Snapshots cost storage on every run, so they are capped and pruned. A
 *      project too large to snapshot cheaply gets no checkpoint and says so,
 *      instead of a half-copy that would destroy the project on rollback.
 * ---------------------------------------------------------------------------
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHECKPOINTS_BUCKET,
  PROJECT_FILES_BUCKET,
  joinStoragePath,
  listStorageFiles,
  removeStoragePrefix,
  storageFileMap,
  uploadBlob,
} from "./storage.ts";
import { AppError } from "./errorHandler.ts";

const MANIFEST_NAME = ".manifest.json";

/** Above these a snapshot stops being cheap enough to take before every run. */
export const MAX_SNAPSHOT_FILES = 400;
export const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

/** Older snapshots are pruned so a chatty project cannot grow without bound. */
export const KEEP_CHECKPOINTS_PER_PROJECT = 10;

export interface CheckpointRow {
  id: string;
  project_id: string;
  session_id: string | null;
  snapshot_path: string;
  created_at: string;
}

export interface SnapshotManifest {
  project_id: string;
  created_at: string;
  files: Array<{ path: string; size: number }>;
}

export type CreateCheckpointResult =
  | { created: true; checkpoint: CheckpointRow; fileCount: number }
  | { created: false; reason: "empty" | "too_large"; detail: string };

/**
 * Copy every project file into the checkpoints bucket and record a row.
 *
 * Returns `created: false` rather than throwing when there is nothing worth
 * snapshotting — the caller is usually a run that should proceed either way.
 */
export async function createCheckpoint(
  service: SupabaseClient,
  params: { projectId: string; sandboxPath: string; sessionId?: string | null },
): Promise<CreateCheckpointResult> {
  const sandboxPath = params.sandboxPath.replace(/^\/+|\/+$/g, "");
  if (!sandboxPath) throw new AppError(400, "INVALID_SANDBOX_PATH", "The project has no sandbox path.");

  const paths = await listStorageFiles(service, PROJECT_FILES_BUCKET, sandboxPath);
  if (paths.length === 0) {
    return { created: false, reason: "empty", detail: "The project has no files yet." };
  }
  if (paths.length > MAX_SNAPSHOT_FILES) {
    return {
      created: false,
      reason: "too_large",
      detail: `${paths.length} files exceeds the ${MAX_SNAPSHOT_FILES}-file snapshot limit.`,
    };
  }

  const checkpointId = crypto.randomUUID();
  const snapshotPath = joinStoragePath("projects", params.projectId, checkpointId);
  const prefixLength = sandboxPath.length + 1;

  try {
    const files = await storageFileMap(service, PROJECT_FILES_BUCKET, sandboxPath);
    const totalBytes = files.reduce((sum, file) => sum + file.data.size, 0);
    if (totalBytes > MAX_SNAPSHOT_BYTES) {
      return {
        created: false,
        reason: "too_large",
        detail: `${Math.round(totalBytes / 1024)} KB exceeds the ${Math.round(MAX_SNAPSHOT_BYTES / 1024)} KB snapshot limit.`,
      };
    }

    const manifest: SnapshotManifest = {
      project_id: params.projectId,
      created_at: new Date().toISOString(),
      files: [],
    };
    for (const file of files) {
      const relative = file.path.startsWith(`${sandboxPath}/`) ? file.path.slice(prefixLength) : file.path;
      await uploadBlob(
        service,
        CHECKPOINTS_BUCKET,
        joinStoragePath(snapshotPath, relative),
        file.data,
        file.data.type || "application/octet-stream",
      );
      manifest.files.push({ path: relative, size: file.data.size });
    }
    // The manifest is written last on purpose: its presence is what marks the
    // snapshot complete, so an interrupted copy can never be restored.
    await uploadBlob(
      service,
      CHECKPOINTS_BUCKET,
      joinStoragePath(snapshotPath, MANIFEST_NAME),
      JSON.stringify(manifest),
      "application/json",
    );

    const { data: checkpoint, error } = await service
      .from("checkpoints")
      .insert({
        id: checkpointId,
        project_id: params.projectId,
        session_id: params.sessionId ?? null,
        snapshot_path: snapshotPath,
      })
      .select("id,project_id,session_id,snapshot_path,created_at")
      .single();
    if (error || !checkpoint) throw error ?? new Error("Checkpoint insert returned no row.");

    await pruneCheckpoints(service, params.projectId).catch(() => undefined);
    return { created: true, checkpoint: checkpoint as CheckpointRow, fileCount: manifest.files.length };
  } catch (error) {
    // A half-written snapshot must not survive — it would look restorable.
    await removeStoragePrefix(service, CHECKPOINTS_BUCKET, snapshotPath).catch(() => undefined);
    throw error;
  }
}

export interface RestoreResult {
  checkpointId: string;
  projectId: string;
  filesRestored: number;
  /** Snapshot of what the project looked like before this rollback, if taken. */
  safetyCheckpointId: string | null;
}

/**
 * Replace the project's files with a snapshot's contents.
 *
 * Before anything is deleted the current state is snapshotted, so a rollback to
 * the wrong point is itself undoable.
 */
export async function restoreCheckpoint(
  service: SupabaseClient,
  checkpointId: string,
): Promise<RestoreResult> {
  const { data: checkpoint, error: checkpointError } = await service
    .from("checkpoints")
    .select("id,project_id,snapshot_path")
    .eq("id", checkpointId)
    .maybeSingle();
  if (checkpointError) throw checkpointError;
  if (!checkpoint) throw new AppError(404, "CHECKPOINT_NOT_FOUND", "Checkpoint was not found.");

  const { data: project, error: projectError } = await service
    .from("projects")
    .select("sandbox_path")
    .eq("id", checkpoint.project_id)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");

  const snapshotPath = String(checkpoint.snapshot_path);
  const snapshotFiles = await storageFileMap(service, CHECKPOINTS_BUCKET, snapshotPath);
  const manifestFile = snapshotFiles.find((file) => file.path.endsWith(`/${MANIFEST_NAME}`));
  if (!manifestFile) {
    throw new AppError(
      409,
      "CHECKPOINT_INCOMPLETE",
      "This snapshot has no manifest, so it cannot be verified. Restoring it could lose files.",
    );
  }

  const manifest = JSON.parse(await manifestFile.data.text()) as SnapshotManifest;
  const payload = snapshotFiles.filter((file) => file !== manifestFile);
  const present = new Set(payload.map((file) => file.path.slice(snapshotPath.length + 1)));
  const missing = manifest.files.filter((entry) => !present.has(entry.path));
  if (missing.length > 0) {
    throw new AppError(
      409,
      "CHECKPOINT_INCOMPLETE",
      `This snapshot is missing ${missing.length} file(s) (e.g. ${missing[0].path}), so restoring it would lose data.`,
    );
  }

  // Undo for the undo. Best effort: a project too large to snapshot should not
  // be blocked from rolling back.
  let safetyCheckpointId: string | null = null;
  try {
    const safety = await createCheckpoint(service, {
      projectId: checkpoint.project_id,
      sandboxPath: String(project.sandbox_path),
    });
    if (safety.created) safetyCheckpointId = safety.checkpoint.id;
  } catch {
    safetyCheckpointId = null;
  }

  await removeStoragePrefix(service, PROJECT_FILES_BUCKET, String(project.sandbox_path));
  for (const file of payload) {
    const relative = file.path.slice(snapshotPath.length + 1);
    await uploadBlob(
      service,
      PROJECT_FILES_BUCKET,
      joinStoragePath(String(project.sandbox_path), relative),
      file.data,
      file.data.type || "application/octet-stream",
    );
  }

  return {
    checkpointId: checkpoint.id,
    projectId: checkpoint.project_id,
    filesRestored: payload.length,
    safetyCheckpointId,
  };
}

/** Drop all but the most recent snapshots of a project, storage included. */
export async function pruneCheckpoints(
  service: SupabaseClient,
  projectId: string,
  keep = KEEP_CHECKPOINTS_PER_PROJECT,
): Promise<number> {
  const { data, error } = await service
    .from("checkpoints")
    .select("id,snapshot_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const stale = (data ?? []).slice(keep);
  for (const row of stale) {
    await removeStoragePrefix(service, CHECKPOINTS_BUCKET, String(row.snapshot_path)).catch(() => undefined);
    await service.from("checkpoints").delete().eq("id", row.id);
  }
  return stale.length;
}
