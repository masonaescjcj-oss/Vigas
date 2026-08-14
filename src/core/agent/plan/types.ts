/**
 * plan/types.ts
 * ---------------------------------------------------------------------------
 * Shared types for Plan Mode (Phase 3). A plan is a structured, inspectable
 * list of steps produced BEFORE any tool runs. Execution, approval, and
 * verification all operate over this shape.
 * ---------------------------------------------------------------------------
 */

export type PlanStepType = "file_create" | "file_edit" | "command_run" | "research";

export interface PlanStep {
  id: string;
  type: PlanStepType;
  description: string;
  /** Tool to run for this step. Defaults are inferred from `type` if omitted. */
  tool?: string;
  /** Arguments passed to the tool. */
  input?: Record<string, unknown>;
  /** Files this step reads or writes — used for subagent isolation & merge. */
  files?: string[];
  /** Ids of steps that must complete before this one. */
  dependsOn?: string[];
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  createdAt: number;
}

/** How much autonomy the user granted (mirrors the client's segmented control). */
export type ExecutionMode = "suggest" | "confirm" | "auto";

export type StepStatus = "done" | "skipped" | "blocked" | "error";

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output: string;
}

export interface PlanExecutionResult {
  planId: string;
  mode: ExecutionMode;
  results: StepResult[];
  executed: number;
  ok: boolean;
}

export interface VerificationResult {
  passed: boolean;
  attempts: number;
  lastOutput: string;
}

export type PlanEvent =
  | { kind: "plan:start"; planId: string; steps: number; at: number }
  | { kind: "step:start"; stepId: string; stepType: PlanStepType; description: string; at: number }
  | { kind: "step:end"; stepId: string; status: StepStatus; output: string; at: number }
  | { kind: "plan:end"; planId: string; ok: boolean; at: number }
  | { kind: "verify:start"; attempt: number; at: number }
  | { kind: "verify:end"; attempt: number; ok: boolean; output: string; at: number };

/** Default tool for a step type when the plan does not name one explicitly. */
export function defaultToolFor(type: PlanStepType): string | null {
  switch (type) {
    case "file_create":
      return "write";
    case "file_edit":
      return "edit";
    case "command_run":
      return "bash";
    case "research":
      return null; // research steps may be reasoning-only
  }
}
