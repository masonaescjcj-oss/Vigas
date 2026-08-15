/**
 * frontend/src/services/checkpointService.ts
 * ---------------------------------------------------------------------------
 * Reads the real `checkpoints` table (RLS: owner-only). Creating and restoring
 * checkpoints is service-role-only on the backend today (checkpoint-create /
 * checkpoint-restore call requireServiceRole), so the client can list history
 * but cannot mutate it — the UI reflects that instead of pretending.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";

export interface CheckpointRow {
  id: string;
  project_id: string;
  session_id: string | null;
  label: string | null;
  created_at: string;
  file_count: number | null;
}

export async function getProjectCheckpoints(projectId: string): Promise<CheckpointRow[]> {
  const { data, error } = await supabase
    .from("checkpoints")
    .select("id,project_id,session_id,label,created_at,file_count")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as CheckpointRow[];
}

export { relativeTime } from "./formatting";
