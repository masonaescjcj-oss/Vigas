/**
 * plan/planExecutor.ts
 * ---------------------------------------------------------------------------
 * Executes an approved plan step-by-step through the secure tool invoker, and
 * streams progress via a plan-event callback (the Phase-1/2 realtime channel).
 *
 * Honors the three autonomy modes from the client's segmented control:
 *   - "suggest": produce the plan only; execute nothing.
 *   - "confirm": ask before each step (via confirmStep); skip on decline.
 *   - "auto":    execute every step without asking.
 * ---------------------------------------------------------------------------
 */

import {
  defaultToolFor,
  type ExecutionMode,
  type Plan,
  type PlanEvent,
  type PlanExecutionResult,
  type PlanStep,
  type StepResult,
} from "./types.ts";
import type { SecureInvoke } from "./secureInvoker.ts";

export interface PlanExecutorDeps {
  invoke: SecureInvoke;
  mode: ExecutionMode;
  /** Required for "confirm" mode; returns true to run the step. */
  confirmStep?: (step: PlanStep) => Promise<boolean> | boolean;
  onEvent?: (e: PlanEvent) => void;
  now: () => number;
}

function resolveToolAndInput(step: PlanStep): { tool: string | null; input: Record<string, unknown> } {
  const tool = step.tool ?? defaultToolFor(step.type);
  return { tool, input: step.input ?? {} };
}

export async function executePlan(plan: Plan, deps: PlanExecutorDeps): Promise<PlanExecutionResult> {
  const emit = (e: PlanEvent) => deps.onEvent?.(e);
  emit({ kind: "plan:start", planId: plan.id, steps: plan.steps.length, at: deps.now() });

  const results: StepResult[] = [];
  let executed = 0;
  let ok = true;

  for (const step of plan.steps) {
    emit({ kind: "step:start", stepId: step.id, stepType: step.type, description: step.description, at: deps.now() });

    // Suggest mode never executes.
    if (deps.mode === "suggest") {
      const r: StepResult = { stepId: step.id, status: "skipped", output: "suggest mode: not executed" };
      results.push(r);
      emit({ kind: "step:end", stepId: step.id, status: r.status, output: r.output, at: deps.now() });
      continue;
    }

    // Confirm mode gates each step.
    if (deps.mode === "confirm") {
      const approved = deps.confirmStep ? await deps.confirmStep(step) : false;
      if (!approved) {
        const r: StepResult = { stepId: step.id, status: "skipped", output: "declined by user" };
        results.push(r);
        emit({ kind: "step:end", stepId: step.id, status: r.status, output: r.output, at: deps.now() });
        continue;
      }
    }

    const { tool, input } = resolveToolAndInput(step);
    if (!tool) {
      // A research step with no tool is reasoning-only; record and continue.
      const r: StepResult = { stepId: step.id, status: "skipped", output: "research step (no tool to run)" };
      results.push(r);
      emit({ kind: "step:end", stepId: step.id, status: r.status, output: r.output, at: deps.now() });
      continue;
    }

    const { result, decision } = await deps.invoke(tool, input);
    let status: StepResult["status"];
    if (decision === "deny") status = "blocked";
    else if (result.isError) status = "error";
    else status = "done";

    if (status !== "done") ok = false;
    if (status === "done" || status === "error") executed++;

    const r: StepResult = { stepId: step.id, status, output: result.content };
    results.push(r);
    emit({ kind: "step:end", stepId: step.id, status, output: result.content, at: deps.now() });
  }

  emit({ kind: "plan:end", planId: plan.id, ok, at: deps.now() });
  return { planId: plan.id, mode: deps.mode, results, executed, ok };
}
