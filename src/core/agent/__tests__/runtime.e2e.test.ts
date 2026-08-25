import { describe, it, expect, beforeEach } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentRuntime } from "../index.ts";
import { ScriptedModel, type ModelResponse } from "../loop.ts";
import { InMemoryAuditSink, InMemoryNotifier } from "../hooks/defaultHooks.ts";

function tc(id: string, name: string, input: Record<string, unknown>) {
  return { id, name, input };
}

/** The scripted plan: plan-first, a blocked-in-plan write, then real edits, then a blocked rm -rf. */
function scriptedTurns(): ModelResponse[] {
  return [
    { toolCalls: [tc("t1", "enter_plan_mode", {})], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t2", "write", { file_path: "notes.txt", contents: "x" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t3", "exit_plan_mode", { plan: "1. write 2. edit" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t4", "write", { file_path: "notes.txt", contents: "hello\nHELLO\nworld\n" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t5", "read", { file_path: "notes.txt" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t6", "edit", { file_path: "notes.txt", old_string: "HELLO", new_string: "GOODBYE" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { toolCalls: [tc("t7", "bash", { command: "rm -rf /" })], usage: { inputTokens: 5, outputTokens: 2 } },
    { text: "All done.", usage: { inputTokens: 5, outputTokens: 3 } },
  ];
}

describe("createAgentRuntime end-to-end", () => {
  let root: string;
  let audit: InMemoryAuditSink;
  let notifier: InMemoryNotifier;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-e2e-"));
    audit = new InMemoryAuditSink();
    notifier = new InMemoryNotifier();
  });

  it("runs a full task with every security layer active", async () => {
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel(scriptedTurns()),
      profile: "standard",
      auditSink: audit,
      notifier,
      networkAllowlist: ["example.com"],
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 20,
    });

    const res = await runtime.run("Set up notes.txt and tidy it.", { title: "demo" });

    // 1) reached the scripted final answer
    expect(res.finalText).toBe("All done.");
    expect(res.stoppedReason).toBe("final");

    // 2) the file was actually written and then edited on disk
    const onDisk = fs.readFileSync(path.join(root, "notes.txt"), "utf8");
    expect(onDisk).toBe("hello\nGOODBYE\nworld\n");

    // 3) the write attempted during plan mode was blocked
    const blockedInPlan = res.session.messages.find(
      (m) => m.role === "tool" && m.isError && m.content.includes("plan mode"),
    );
    expect(blockedInPlan).toBeDefined();

    // 4) the rm -rf was blocked by the policy engine
    const blockedRm = res.session.messages.find(
      (m) => m.role === "tool" && m.isError && m.content.includes("Blocked by policy"),
    );
    expect(blockedRm).toBeDefined();

    // 5) usage accounting
    expect(res.usage.toolCalls).toBe(7);
    expect(res.usage.steps).toBe(8);
    expect(res.usage.inputTokens).toBeGreaterThan(0);

    // 6) audit + realtime hooks fired for every tool call (start+end)
    expect(audit.entries.filter((e) => e.phase === "start").length).toBe(7);
    expect(audit.entries.filter((e) => e.phase === "end").length).toBe(7);
    expect(notifier.events.filter((e) => e.type === "tool:start").length).toBe(7);
    expect(notifier.events.filter((e) => e.type === "tool:end").length).toBe(7);

    // 7) session persisted and exportable
    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(1);
    const json = await runtime.exportSessionJson(res.sessionId);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.messages.length).toBeGreaterThan(0);

    // 8) getUsage reflects the run
    const usage = await runtime.getUsage(res.sessionId);
    expect(usage.toolCalls).toBe(7);
  });

  it("supports fork and resume", async () => {
    let n = 0;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([{ text: "hi" }]),
      now: () => ++n,
      idFactory: () => `f${++idc}`,
    });
    const res = await runtime.run("hello");
    const original = res.session;
    expect(original.messages.length).toBeGreaterThanOrEqual(2);

    const forked = await runtime.forkSession(res.sessionId, 0);
    expect(forked.parentId).toBe(res.sessionId);
    expect(forked.forkedFromIndex).toBe(0);
    expect(forked.messages).toHaveLength(1);

    const resumed = await runtime.resumeSession(res.sessionId);
    expect(resumed.status).toBe("active");
    expect(resumed.id).toBe(res.sessionId);
  });

  it("readonly profile blocks writes end-to-end", async () => {
    let n = 0;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      profile: "readonly",
      model: new ScriptedModel([
        { toolCalls: [tc("w", "write", { file_path: "x.txt", contents: "nope" })] },
        { text: "cannot write in readonly" },
      ]),
      now: () => ++n,
      idFactory: () => `r${++idc}`,
    });
    const res = await runtime.run("try to write");
    const blocked = res.session.messages.find((m) => m.role === "tool" && m.isError);
    expect(blocked).toBeDefined();
    expect(fs.existsSync(path.join(root, "x.txt"))).toBe(false);
  });
});

describe("a run that outgrows its step budget", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-steps-"));
  });

  /** A model that never finishes — always another file to write. */
  function neverFinishes(count: number): ModelResponse[] {
    return Array.from({ length: count }, (_, i) => ({
      toolCalls: [tc(`s${i}`, "write", { file_path: `file${i}.txt`, contents: `${i}` })],
      usage: { inputTokens: 5, outputTokens: 2 },
    }));
  }

  it("says it ran out rather than returning nothing", async () => {
    // The failure behind "it doesn't work for big apps": a build that hits the
    // ceiling used to return an empty finalText, and the worker recorded it as
    // a success. A truncated build looked exactly like a finished one — no
    // message, no warning, just a run that stopped.
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel(neverFinishes(20)),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 5,
    });

    const res = await runtime.run("Build something enormous.");

    expect(res.stoppedReason).toBe("max-steps");
    // The part that matters to the person reading it.
    expect(res.finalText.length).toBeGreaterThan(0);
    expect(res.finalText.toLowerCase()).toContain("continue");
  });

  it("keeps the work it did manage", async () => {
    // Running out is not a failure — the files written up to that point are
    // real, and the next turn continues from them.
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel(neverFinishes(20)),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 4,
    });

    await runtime.run("Build something enormous.");
    expect(fs.existsSync(path.join(root, "file0.txt"))).toBe(true);
  });

  it("leaves the session resumable, not completed", async () => {
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel(neverFinishes(20)),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 3,
    });

    const res = await runtime.run("Build something enormous.");
    // "completed" would stop the user being able to carry on from here.
    expect(res.session.status).toBe("paused");
  });
});
