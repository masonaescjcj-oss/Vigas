import { describe, it, expect, beforeEach } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { SandboxFs } from "../workspace/sandboxFs.ts";
import {
  planToSubtasks,
  runSubtasks,
  DEFAULT_SUBAGENT_CONFIG,
  type SubagentConfig,
  type SubTask,
  type SplitResult,
} from "../subagent/spawner.ts";
import { mergeOutcomes, applyMerge } from "../subagent/mergeStrategy.ts";
import type { Plan, PlanStep } from "../plan/types.ts";

let seq = 0;
const idFactory = () => `st${++seq}`;

function step(id: string, file: string): PlanStep {
  return { id, type: "file_edit", tool: "edit", description: `edit ${file}`, input: { file_path: file }, files: [file] };
}

function planWith(files: string[]): Plan {
  return { id: "p", goal: "g", createdAt: 0, steps: files.map((f, i) => step(`s${i}`, f)) };
}

const cfg = (o: Partial<SubagentConfig> = {}): SubagentConfig => ({ ...DEFAULT_SUBAGENT_CONFIG, ...o });

describe("subagent spawner", () => {
  it("splits independent file groups into parallel subtasks (<= cap)", () => {
    const split = planToSubtasks(planWith(["a.ts", "b.ts", "c.ts"]), cfg(), idFactory);
    expect(split.mode).toBe("parallel");
    expect(split.subtasks).toHaveLength(3);
  });

  it("falls back to SERIAL when independent groups exceed the 3-subagent cap", () => {
    const split = planToSubtasks(planWith(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"]), cfg(), idFactory);
    expect(split.mode).toBe("serial");
    expect(split.reason).toContain("cap");
  });

  it("falls back to SERIAL when the token budget is exceeded", () => {
    const split = planToSubtasks(planWith(["a.ts", "b.ts"]), cfg({ tokenBudget: 1 }), idFactory);
    expect(split.mode).toBe("serial");
    expect(split.reason).toContain("budget");
  });

  it("is disabled by config flag", () => {
    const split = planToSubtasks(planWith(["a.ts", "b.ts", "c.ts"]), cfg({ enabled: false }), idFactory);
    expect(split.mode).toBe("serial");
  });

  it("groups steps that share a file into ONE subtask (not independent)", () => {
    const plan: Plan = {
      id: "p", goal: "g", createdAt: 0,
      steps: [step("s0", "shared.ts"), step("s1", "shared.ts"), step("s2", "other.ts")],
    };
    const split = planToSubtasks(plan, cfg(), idFactory);
    // two groups: {shared.ts x2}, {other.ts} -> parallel with 2 subtasks
    expect(split.mode).toBe("parallel");
    expect(split.subtasks).toHaveLength(2);
  });
});

describe("subagent runSubtasks", () => {
  let root: string;
  let ws: SandboxFs;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-sub-"));
    ws = new SandboxFs({ sandboxRoot: root });
  });

  it("runs bounded-parallel subtasks in isolation and merges clean changes", async () => {
    const split = planToSubtasks(planWith(["a.ts", "b.ts", "c.ts"]), cfg(), idFactory);
    const report = await runSubtasks(split, {
      workspace: ws,
      config: cfg(),
      runner: async (st, ctx) => {
        await new Promise((r) => setTimeout(r, 5)); // force overlap to observe concurrency
        ctx.write(st.files[0], `content of ${st.files[0]}`);
      },
    });
    expect(report.mode).toBe("parallel");
    expect(report.ranParallel).toBe(3);
    expect(report.peakConcurrency).toBeGreaterThan(1);
    expect(report.peakConcurrency).toBeLessThan(4); // never more than 3
    expect(report.applied).toBe(true);
    expect(fs.readFileSync(path.join(root, "a.ts"), "utf8")).toBe("content of a.ts");
  });

  it("NEVER runs more than 3 subtasks concurrently, even if handed more", async () => {
    // Manually hand it 5 subtasks; the coordinator must slice to the cap.
    const subtasks: SubTask[] = ["a", "b", "c", "d", "e"].map((f) => ({
      id: `x_${f}`, description: f, steps: [step(f, `${f}.ts`)], files: [`${f}.ts`],
    }));
    const split: SplitResult = { mode: "parallel", subtasks, reason: "manual", estimatedTokens: 0 };
    const report = await runSubtasks(split, {
      workspace: ws,
      config: cfg(),
      runner: async (st, ctx) => ctx.write(st.files[0], "z"),
    });
    expect(report.ranParallel).toBe(3); // sliced to the cap
  });

  it("detects a real conflict (two subagents edit the SAME file) and does NOT overwrite", async () => {
    fs.writeFileSync(path.join(root, "shared.ts"), "ORIGINAL");
    const subtasks: SubTask[] = [
      { id: "A", description: "A", steps: [step("a", "shared.ts")], files: ["shared.ts"] },
      { id: "B", description: "B", steps: [step("b", "shared.ts")], files: ["shared.ts"] },
    ];
    const split: SplitResult = { mode: "parallel", subtasks, reason: "manual", estimatedTokens: 0 };
    const report = await runSubtasks(split, {
      workspace: ws,
      config: cfg(),
      runner: async (st, ctx) => ctx.write("shared.ts", st.id === "A" ? "VERSION_A" : "VERSION_B"),
    });
    expect(report.applied).toBe(false);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].file).toBe("shared.ts");
    // base file must be untouched — no silent overwrite
    expect(fs.readFileSync(path.join(root, "shared.ts"), "utf8")).toBe("ORIGINAL");
  });
});

describe("mergeStrategy", () => {
  it("merges non-overlapping changes cleanly", () => {
    const r = mergeOutcomes([
      { subtaskId: "A", changes: { "a.ts": "1" } },
      { subtaskId: "B", changes: { "b.ts": "2" } },
    ]);
    expect(r.applicable).toBe(true);
    expect(r.conflicts).toHaveLength(0);
  });

  it("treats identical edits to the same file as non-conflicting", () => {
    const r = mergeOutcomes([
      { subtaskId: "A", changes: { "a.ts": "same" } },
      { subtaskId: "B", changes: { "a.ts": "same" } },
    ]);
    expect(r.applicable).toBe(true);
  });

  it("flags conflicting edits and applyMerge refuses to overwrite", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-merge-"));
    const ws = new SandboxFs({ sandboxRoot: root });
    const r = mergeOutcomes([
      { subtaskId: "A", changes: { "a.ts": "1" } },
      { subtaskId: "B", changes: { "a.ts": "2" } },
    ]);
    expect(r.applicable).toBe(false);
    await expect(applyMerge(ws, r)).rejects.toThrow("refusing to apply");
  });
});
