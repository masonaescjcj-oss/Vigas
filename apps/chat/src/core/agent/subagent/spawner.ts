/**
 * subagent/spawner.ts
 * ---------------------------------------------------------------------------
 * Bounded parallel subagents. A large task is split into AT MOST
 * `maxSubagents` (default 3) genuinely independent subtasks, and only when the
 * plan actually contains disjoint work. Hard limits:
 *
 *   - Never more than `maxSubagents` subtasks run concurrently.
 *   - If the estimated token cost exceeds `tokenBudget` (default ~200k), or the
 *     work does not cleanly split, subagents are DISABLED and the caller runs
 *     the plan serially instead.
 *   - Results are merged conservatively; a conflict never auto-overwrites.
 * ---------------------------------------------------------------------------
 */

import type { Plan, PlanStep } from "../plan/types.ts";
import type { Workspace } from "../toolRegistry.ts";
import { estimateTokens } from "../session/compact.ts";
import { createIsolatedContext, type IsolatedContext } from "./isolatedContext.ts";
import { mergeOutcomes, applyMerge, type MergeConflict, type SubagentOutcome } from "./mergeStrategy.ts";

export interface SubagentConfig {
  enabled: boolean;
  maxSubagents: number;
  /** Token ceiling above which parallel subagents are disabled. */
  tokenBudget: number;
}

export const DEFAULT_SUBAGENT_CONFIG: SubagentConfig = {
  enabled: true,
  maxSubagents: 3,
  tokenBudget: 200_000,
};

export interface SubTask {
  id: string;
  description: string;
  steps: PlanStep[];
  files: string[];
}

export interface SplitResult {
  mode: "parallel" | "serial";
  subtasks: SubTask[];
  reason: string;
  estimatedTokens: number;
}

function filesOf(step: PlanStep): string[] {
  if (step.files && step.files.length) return step.files;
  const fp = step.input?.file_path;
  return typeof fp === "string" ? [fp] : [];
}

function estimatePlanTokens(plan: Plan): number {
  return plan.steps.reduce(
    (sum, s) => sum + estimateTokens(s.description + JSON.stringify(s.input ?? {})),
    0,
  );
}

/** Union-find grouping of steps connected by shared files or dependencies. */
export function independentGroups(steps: PlanStep[]): PlanStep[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };
  for (const s of steps) parent.set(s.id, s.id);

  const fileOwner = new Map<string, string>();
  for (const step of steps) {
    for (const f of filesOf(step)) {
      const owner = fileOwner.get(f);
      if (owner) union(step.id, owner);
      else fileOwner.set(f, step.id);
    }
    for (const dep of step.dependsOn ?? []) {
      if (parent.has(dep)) union(step.id, dep);
    }
  }

  const groups = new Map<string, PlanStep[]>();
  for (const step of steps) {
    const root = find(step.id);
    const g = groups.get(root) ?? [];
    g.push(step);
    groups.set(root, g);
  }
  return [...groups.values()];
}

/** Decide whether a plan should run as bounded parallel subtasks or serially. */
export function planToSubtasks(
  plan: Plan,
  config: SubagentConfig,
  idFactory: () => string,
): SplitResult {
  const estimatedTokens = estimatePlanTokens(plan);

  if (!config.enabled) {
    return { mode: "serial", subtasks: [], reason: "subagents disabled by config", estimatedTokens };
  }
  if (estimatedTokens > config.tokenBudget) {
    return {
      mode: "serial",
      subtasks: [],
      reason: `estimated ${estimatedTokens} tokens exceeds budget ${config.tokenBudget}; running serially`,
      estimatedTokens,
    };
  }

  const groups = independentGroups(plan.steps);
  if (groups.length < 2) {
    return { mode: "serial", subtasks: [], reason: "no independent work to parallelize", estimatedTokens };
  }
  if (groups.length > config.maxSubagents) {
    return {
      mode: "serial",
      subtasks: [],
      reason: `${groups.length} independent groups exceeds the ${config.maxSubagents}-subagent cap; running serially`,
      estimatedTokens,
    };
  }

  const subtasks: SubTask[] = groups.map((steps) => {
    const files = [...new Set(steps.flatMap(filesOf))];
    return {
      id: idFactory(),
      description: steps[0]?.description ?? "subtask",
      steps,
      files,
    };
  });
  return { mode: "parallel", subtasks, reason: `split into ${subtasks.length} independent subtask(s)`, estimatedTokens };
}

/** Runs one subtask against its isolated overlay; mutates the overlay only. */
export type SubagentRunner = (subtask: SubTask, ctx: IsolatedContext) => Promise<void>;

export interface RunSubtasksDeps {
  workspace: Workspace;
  config: SubagentConfig;
  runner: SubagentRunner;
}

export interface SubagentRunReport {
  mode: "parallel" | "serial";
  ranParallel: number;
  peakConcurrency: number;
  applied: boolean;
  appliedFiles: string[];
  conflicts: MergeConflict[];
  reason: string;
}

/**
 * Execute the parallel subtasks (bounded by maxSubagents) in isolated contexts,
 * then merge. If `split.mode` is serial, returns a report telling the caller to
 * run the plan serially instead (no isolation/merge performed).
 */
export async function runSubtasks(split: SplitResult, deps: RunSubtasksDeps): Promise<SubagentRunReport> {
  if (split.mode === "serial") {
    return {
      mode: "serial",
      ranParallel: 0,
      peakConcurrency: 0,
      applied: false,
      appliedFiles: [],
      conflicts: [],
      reason: split.reason,
    };
  }

  // Hard cap enforcement, defense-in-depth (split already guarantees this).
  const subtasks = split.subtasks.slice(0, deps.config.maxSubagents);

  let active = 0;
  let peak = 0;
  const outcomes: SubagentOutcome[] = await Promise.all(
    subtasks.map(async (st) => {
      active++;
      peak = Math.max(peak, active);
      try {
        const ctx = await createIsolatedContext(deps.workspace, st.files);
        await deps.runner(st, ctx);
        return { subtaskId: st.id, changes: ctx.changedFiles() };
      } finally {
        active--;
      }
    }),
  );

  const merge = mergeOutcomes(outcomes);
  let appliedFiles: string[] = [];
  if (merge.applicable) {
    appliedFiles = await applyMerge(deps.workspace, merge);
  }

  return {
    mode: "parallel",
    ranParallel: subtasks.length,
    peakConcurrency: peak,
    applied: merge.applicable,
    appliedFiles,
    conflicts: merge.conflicts,
    reason: merge.applicable
      ? `merged ${appliedFiles.length} file(s) from ${subtasks.length} subagent(s)`
      : `halted: ${merge.conflicts.length} conflict(s) require resolution (no files overwritten)`,
  };
}
