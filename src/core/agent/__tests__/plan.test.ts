import { describe, it, expect, beforeEach } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentRuntime } from "../index.ts";
import { ScriptedModel } from "../loop.ts";
import { parsePlan, modelPlanSource, type PlanSource } from "../plan/planGenerator.ts";
import { verifyUntilPass } from "../plan/planVerifier.ts";
import type { Plan } from "../plan/types.ts";

function fixedPlan(root: string): Plan {
  return {
    id: "plan1",
    goal: "create and edit notes",
    createdAt: 0,
    steps: [
      { id: "s1", type: "file_create", tool: "write", description: "create notes.txt", input: { file_path: "notes.txt", contents: "hello\nHELLO\n" }, files: ["notes.txt"] },
      { id: "s2", type: "file_edit", tool: "edit", description: "fix greeting", input: { file_path: "notes.txt", old_string: "HELLO", new_string: "GOODBYE" }, files: ["notes.txt"] },
    ],
  };
}

function scriptedSource(root: string): PlanSource {
  return { proposePlan: () => fixedPlan(root) };
}

function mkRuntime(root: string, extra: Record<string, unknown> = {}) {
  let n = 0;
  let idc = 0;
  return createAgentRuntime({
    sandboxRoot: root,
    model: new ScriptedModel([{ text: "unused" }]),
    planSource: scriptedSource(root),
    now: () => ++n,
    idFactory: () => `p${++idc}`,
    ...extra,
  });
}

describe("Plan Mode", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-plan-"));
  });

  it("planGenerator produces a structured plan WITHOUT executing anything", async () => {
    const runtime = mkRuntime(root);
    const plan = await runtime.plan("set up notes");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe("file_create");
    // nothing was written to disk during planning
    expect(fs.existsSync(path.join(root, "notes.txt"))).toBe(false);
  });

  it("parsePlan validates and parses model JSON", () => {
    const json = '```json\n{"steps":[{"type":"command_run","description":"build","tool":"bash","input":{"command":"echo hi"}}]}\n```';
    const plan = parsePlan(json, { goal: "g", now: () => 1, idFactory: () => "x" });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].type).toBe("command_run");
    expect(() => parsePlan("not json", { goal: "g", now: () => 1, idFactory: () => "x" })).toThrow();
  });

  it("modelPlanSource turns a JSON-returning model into a plan (no tools exposed)", async () => {
    const model = new ScriptedModel([
      { text: '{"steps":[{"type":"file_create","description":"x","input":{"file_path":"a.txt","contents":"y"}}]}' },
    ]);
    const src = modelPlanSource(model, { now: () => 0, idFactory: () => "id" });
    const plan = await src.proposePlan("make a.txt");
    expect(plan.steps[0].type).toBe("file_create");
  });

  it('mode "suggest" executes nothing', async () => {
    const runtime = mkRuntime(root);
    const res = await runtime.runPlan("go", { mode: "suggest" });
    expect(res.execution.results.every((r) => r.status === "skipped")).toBe(true);
    expect(fs.existsSync(path.join(root, "notes.txt"))).toBe(false);
  });

  it('mode "confirm" runs a step only when confirmed', async () => {
    const yes = mkRuntime(root);
    const resYes = await yes.runPlan("go", { mode: "confirm", confirmStep: () => true });
    expect(resYes.execution.results.every((r) => r.status === "done")).toBe(true);
    expect(fs.readFileSync(path.join(root, "notes.txt"), "utf8")).toBe("hello\nGOODBYE\n");

    const root2 = fs.mkdtempSync(path.join(os.tmpdir(), "issac-plan2-"));
    const no = mkRuntime(root2);
    const resNo = await no.runPlan("go", { mode: "confirm", confirmStep: () => false });
    expect(resNo.execution.results.every((r) => r.status === "skipped")).toBe(true);
    expect(fs.existsSync(path.join(root2, "notes.txt"))).toBe(false);
  });

  it('mode "auto" executes everything', async () => {
    const runtime = mkRuntime(root);
    const res = await runtime.runPlan("go", { mode: "auto" });
    expect(res.execution.ok).toBe(true);
    expect(res.execution.executed).toBe(2);
    expect(fs.readFileSync(path.join(root, "notes.txt"), "utf8")).toBe("hello\nGOODBYE\n");
  });

  it("planVerifier does a REAL check via a shell command after execution", async () => {
    const runtime = mkRuntime(root, { autoApproveAsk: true }); // allow the verify bash to run
    const res = await runtime.runPlan("go", { mode: "auto", verify: { command: "test -f notes.txt", maxAttempts: 1 } });
    expect(res.verification).toBeDefined();
    expect(res.verification!.passed).toBe(true);

    // and it genuinely fails when the check fails:
    const res2 = await runtime.runPlan("go", { mode: "auto", verify: { command: "test -f does-not-exist.zzz", maxAttempts: 1 } });
    expect(res2.verification!.passed).toBe(false);
  }, 15_000);

  it("verifyUntilPass is a goal loop: retries with repair until the check passes", async () => {
    let attempts = 0;
    let fixed = false;
    const res = await verifyUntilPass({
      verify: async () => {
        attempts++;
        return { ok: fixed, output: fixed ? "green" : "red" };
      },
      repair: async () => {
        fixed = true; // the repair makes the next verification pass
      },
      maxAttempts: 3,
      now: () => 0,
    });
    expect(res.passed).toBe(true);
    expect(res.attempts).toBe(2); // failed once, repaired, passed on the 2nd
    expect(attempts).toBe(2);
  });
});
