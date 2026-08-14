/**
 * subagent/mergeStrategy.ts
 * ---------------------------------------------------------------------------
 * Reconciles the changes produced by parallel subagents. The rule is
 * conservative and safe:
 *
 *   - If two subagents changed the SAME file to DIFFERENT contents, that is a
 *     conflict. We NEVER auto-pick a winner or overwrite silently. Execution
 *     stops and the conflict is surfaced for the main agent or user to resolve.
 *   - If two subagents produced IDENTICAL contents for a file, that is not a
 *     conflict.
 *   - Non-overlapping changes merge cleanly.
 * ---------------------------------------------------------------------------
 */

import type { Workspace } from "../toolRegistry.ts";

export interface SubagentOutcome {
  subtaskId: string;
  /** relPath -> new contents, or null for a deletion. */
  changes: Record<string, string | null>;
}

export interface MergeConflict {
  file: string;
  subtaskIds: string[];
  /** Distinct proposed contents (null denotes a deletion), for the resolver. */
  proposals: Array<{ subtaskId: string; contents: string | null }>;
}

export interface MergeResult {
  /** Clean, non-conflicting changes to apply (relPath -> contents|null). */
  merged: Record<string, string | null>;
  conflicts: MergeConflict[];
  /** True only when there are no conflicts and the merge is safe to apply. */
  applicable: boolean;
}

export function mergeOutcomes(outcomes: SubagentOutcome[]): MergeResult {
  // file -> list of (subtaskId, contents)
  const byFile = new Map<string, Array<{ subtaskId: string; contents: string | null }>>();
  for (const outcome of outcomes) {
    for (const [file, contents] of Object.entries(outcome.changes)) {
      const arr = byFile.get(file) ?? [];
      arr.push({ subtaskId: outcome.subtaskId, contents });
      byFile.set(file, arr);
    }
  }

  const merged: Record<string, string | null> = {};
  const conflicts: MergeConflict[] = [];

  for (const [file, proposals] of byFile.entries()) {
    const distinct = new Set(proposals.map((p) => JSON.stringify(p.contents)));
    if (distinct.size === 1) {
      // All subagents agree (or only one touched it) — safe.
      merged[file] = proposals[0].contents;
    } else {
      conflicts.push({
        file,
        subtaskIds: proposals.map((p) => p.subtaskId),
        proposals,
      });
    }
  }

  return { merged, conflicts, applicable: conflicts.length === 0 };
}

/** Apply a clean merge to the base workspace. Refuses if there are conflicts. */
export async function applyMerge(ws: Workspace, result: MergeResult): Promise<string[]> {
  if (!result.applicable) {
    throw new Error(
      `applyMerge: refusing to apply — ${result.conflicts.length} unresolved conflict(s): ` +
        result.conflicts.map((c) => c.file).join(", "),
    );
  }
  const applied: string[] = [];
  for (const [file, contents] of Object.entries(result.merged)) {
    if (contents === null) {
      if (await ws.exists(file)) await ws.deleteFile(file);
    } else {
      await ws.writeFile(file, contents);
    }
    applied.push(file);
  }
  return applied;
}
