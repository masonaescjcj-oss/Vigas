/**
 * frontend/src/services/checkpointService.ts
 * ---------------------------------------------------------------------------
 * Restore points for a project's files.
 *
 * The worker snapshots before every run that can write, so the history here is
 * "what the project looked like before each turn". Rolling back replaces the
 * project's files with a snapshot — and takes a snapshot of the current state
 * first, so the rollback itself is undoable.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import { API_ORIGIN, IS_LOCAL_API, invokeFunction } from "./functionsClient";

export interface CheckpointRow {
  id: string;
  project_id: string;
  session_id: string | null;
  created_at: string;
  /** Title of the chat this snapshot was taken for, when there was one. */
  session_title: string | null;
}

export interface RestoreResult {
  restored: boolean;
  files_restored: number;
  /** Snapshot of the state this rollback replaced — lets the user undo it. */
  safety_checkpoint_id: string | null;
}

/**
 * PostgREST returns an embedded row as an object or, when it cannot prove the
 * relationship is to-one, as a one-element array. Accept both.
 */
type EmbeddedSession = { title: string | null } | Array<{ title: string | null }> | null;

type CheckpointQueryRow = Omit<CheckpointRow, "session_title"> & {
  agent_sessions?: EmbeddedSession;
};

function embeddedTitle(session: EmbeddedSession | undefined): string | null {
  if (!session) return null;
  return (Array.isArray(session) ? session[0]?.title : session.title) ?? null;
}

/**
 * The table has no label column; the chat's title is the label that means
 * something to a person ("before: add a dark mode toggle").
 */
export async function getProjectCheckpoints(projectId: string): Promise<CheckpointRow[]> {
  if (IS_LOCAL_API) {
    // Guest sessions have no real JWT, so an RLS read would return nothing.
    const res = await fetch(`${API_ORIGIN}/api/projects/${projectId}/checkpoints`);
    if (!res.ok) throw new Error(`Loading checkpoints failed: ${res.status}`);
    return (await res.json()) as CheckpointRow[];
  }

  const { data, error } = await supabase
    .from("checkpoints")
    .select("id,project_id,session_id,created_at,agent_sessions(title)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as CheckpointQueryRow[]).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    session_id: row.session_id,
    created_at: row.created_at,
    session_title: embeddedTitle(row.agent_sessions),
  }));
}

/** Roll the project's files back to this snapshot. Destructive but undoable. */
export async function restoreCheckpoint(checkpointId: string): Promise<RestoreResult> {
  return invokeFunction<RestoreResult>("checkpoint-restore", { body: { checkpointId } });
}

/** Take a restore point on demand, outside the automatic pre-run snapshot. */
export async function createCheckpoint(
  projectId: string,
  sessionId?: string | null,
): Promise<{ checkpoint: CheckpointRow | null; skipped?: string; detail?: string }> {
  return invokeFunction("checkpoint-create", {
    body: { projectId, ...(sessionId ? { sessionId } : {}) },
  });
}

export { relativeTime } from "./formatting";
