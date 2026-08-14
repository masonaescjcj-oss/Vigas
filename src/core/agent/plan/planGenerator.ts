/**
 * plan/planGenerator.ts
 * ---------------------------------------------------------------------------
 * Turns a user prompt into a structured {@link Plan} WITHOUT executing any
 * tool. Generation is model-driven but side-effect free: the model is asked to
 * emit a JSON plan, which we parse and validate. Nothing touches the filesystem
 * here — that is the whole point of plan-first execution.
 * ---------------------------------------------------------------------------
 */

import type { Plan, PlanStep, PlanStepType } from "./types.ts";
import type { ChatModel } from "../loop.ts";

/** A source of plans. Implementations must not run tools. */
export interface PlanSource {
  proposePlan(prompt: string): Promise<Plan> | Plan;
}

const VALID_TYPES: PlanStepType[] = ["file_create", "file_edit", "command_run", "research"];

export interface PlanParseDeps {
  goal: string;
  now: () => number;
  idFactory: () => string;
}

/** Parse and validate a plan from model-produced JSON text. Throws on garbage. */
export function parsePlan(jsonText: string, deps: PlanParseDeps): Plan {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(jsonText));
  } catch (e) {
    throw new Error(`planGenerator: model did not return valid JSON: ${(e as Error).message}`);
  }
  const obj = raw as { steps?: unknown };
  if (!obj || !Array.isArray(obj.steps)) {
    throw new Error("planGenerator: plan JSON must have a `steps` array.");
  }

  const steps: PlanStep[] = obj.steps.map((s, i) => {
    const step = s as Partial<PlanStep>;
    const type = step.type as PlanStepType;
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`planGenerator: step ${i} has invalid type "${String(step.type)}".`);
    }
    return {
      id: step.id ?? deps.idFactory(),
      type,
      description: String(step.description ?? `Step ${i + 1}`),
      tool: step.tool,
      input: step.input ?? {},
      files: step.files ?? [],
      dependsOn: step.dependsOn ?? [],
    };
  });

  return { id: deps.idFactory(), goal: deps.goal, steps, createdAt: deps.now() };
}

/** Pull the first JSON object/array out of a possibly chatty model reply. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

/** Wrap a ChatModel as a plan source (asks it for a JSON plan, parses, no tools run). */
export function modelPlanSource(
  model: ChatModel,
  deps: { now: () => number; idFactory: () => string; systemPrompt?: string },
): PlanSource {
  const planInstruction =
    (deps.systemPrompt ? deps.systemPrompt + "\n\n" : "") +
    "You are in PLAN MODE. Do NOT call any tools. Respond ONLY with a JSON object " +
    '{"steps":[{"id","type","description","tool","input","files","dependsOn"}]} where ' +
    "type is one of file_create|file_edit|command_run|research.";
  return {
    async proposePlan(prompt: string): Promise<Plan> {
      const resp = await model.generate({
        systemPrompt: planInstruction,
        messages: [{ id: "u", role: "user", content: prompt, createdAt: deps.now() }],
        tools: [], // plan mode exposes no tools — the model cannot act
      });
      if (!resp.text) throw new Error("planGenerator: model returned no plan text.");
      return parsePlan(resp.text, { goal: prompt, now: deps.now, idFactory: deps.idFactory });
    },
  };
}

/** Convenience: generate a plan from any source. */
export async function generatePlan(source: PlanSource, prompt: string): Promise<Plan> {
  return source.proposePlan(prompt);
}
