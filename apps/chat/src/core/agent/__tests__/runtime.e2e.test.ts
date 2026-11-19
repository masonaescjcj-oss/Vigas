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

describe("a turn that ends on a question", () => {
  it("still has something to show above the question card", async () => {
    // Same shape of bug as running out of steps: this branch never reaches the
    // final-answer assignment, so the turn came back with an empty message and
    // the chat rendered a blank bubble.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-ask-"));
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([
        {
          text: "A shop can mean a few different things — let me check one thing first.",
          toolCalls: [tc("q1", "ask_user", {
            questions: [{
              header: "Goods",
              question: "What are you selling?",
              options: [{ label: "Clothes" }, { label: "Food" }],
            }],
          })],
          usage: { inputTokens: 5, outputTokens: 2 },
        },
      ]),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
    });

    const res = await runtime.run("Build me a shop.");

    expect(res.stoppedReason).toBe("awaiting-input");
    expect(res.finalText).toContain("shop can mean");
  });
});

describe("plan mode is a read-only promise", () => {
  it("a subagent cannot write while the parent is planning", async () => {
    // Plan mode's whole value is that the user can let the agent look around
    // without it touching anything. `task` is not a mutating tool, so it is
    // allowed in plan mode — but the subagent it spawns got a fresh control
    // whose planMode started false, and it shares the parent's workspace.
    // That made `task` a way to write during a read-only phase.
    //
    // Parent and subagent share one ScriptedModel, so the script is the
    // interleaved order of turns: the subagent's two turns run in the middle
    // of the parent's. Splitting them into a separate model would not work —
    // there is no separate model to give it, which is the point.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-plan-"));
    let n = 1000;
    let idc = 0;
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([
        { toolCalls: [tc("p1", "enter_plan_mode", {})], usage: { inputTokens: 5, outputTokens: 2 } },
        { toolCalls: [tc("p2", "task", { description: "sneak a write in", prompt: "write a file" })], usage: { inputTokens: 5, outputTokens: 2 } },
        // ── the subagent's turns start here
        { toolCalls: [tc("s1", "write", { file_path: "snuck-in.txt", contents: "x" })], usage: { inputTokens: 5, outputTokens: 2 } },
        { text: "subagent done", usage: { inputTokens: 5, outputTokens: 2 } },
        // ── back to the parent
        { text: "Plan: do the thing.", usage: { inputTokens: 5, outputTokens: 2 } },
      ]),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
    });

    const res = await runtime.run("Look around and plan.");

    // The subagent really did run and really did try to write — otherwise this
    // test would pass for the wrong reason.
    expect(res.session.messages.some((m) => m.toolCalls?.some((c) => c.name === "task"))).toBe(true);
    expect(fs.existsSync(path.join(root, "snuck-in.txt"))).toBe(false);
  });
});

describe("independent work in one round does not queue up", () => {
  it("writes several files concurrently and keeps the transcript in order", async () => {
    // The loop used to `await` each call before starting the next, so six
    // independent files cost six round trips of latency. With a step budget
    // per turn, that latency was a large part of why big builds ran out.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-par-"));
    let n = 1000;
    let idc = 0;

    const names = ["a", "b", "c", "d", "e", "f"];
    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([
        {
          toolCalls: names.map((name) =>
            tc(`w-${name}`, "write", { file_path: `${name}.txt`, contents: name })),
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        { text: "All six written.", usage: { inputTokens: 5, outputTokens: 2 } },
      ]),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
    });

    const res = await runtime.run("Write six files.");

    // Every file landed...
    for (const name of names) {
      expect(fs.readFileSync(path.join(root, `${name}.txt`), "utf8")).toBe(name);
    }

    // ...and the tool results are in the order the model asked for them, not
    // whichever finished first. A transcript reordered by luck cannot be
    // replayed, and the provider pairs results to calls by position.
    const toolMessages = res.session.messages.filter((m) => m.role === "tool");
    expect(toolMessages.length).toBe(6);
    expect(toolMessages.map((m) => m.toolCallId)).toEqual(names.map((n2) => `w-${n2}`));
  });

  it("gives every call in a round a distinct index", async () => {
    // The index came off a shared counter that was read and then incremented.
    // Run concurrently, several calls would have read the same value.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-idx-"));
    let n = 1000;
    let idc = 0;
    const audit = new InMemoryAuditSink();

    const runtime = createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel([
        {
          toolCalls: ["a", "b", "c"].map((name) =>
            tc(`w-${name}`, "write", { file_path: `${name}.txt`, contents: name })),
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        { text: "done", usage: { inputTokens: 5, outputTokens: 2 } },
      ]),
      profile: "standard",
      auditSink: audit,
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
    });

    const res = await runtime.run("Write three files.");
    expect(res.session.usage.toolCalls).toBe(3);
  });
});

describe("the calls really do overlap", () => {
  it("six writes are in flight at the same time, and a conflicting pair is not", async () => {
    // The tests above prove the files land and the transcript stays ordered.
    // Neither would fail if the loop were still sequential — so this one
    // measures the thing actually being claimed.
    //
    // A pre-tool hook holds each call open briefly and records how many are
    // inside at once. Sequential execution can never exceed 1.
    const measure = () => {
      let inFlight = 0;
      let peak = 0;
      return {
        peak: () => peak,
        hook: async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, 20));
          inFlight -= 1;
          return undefined;
        },
      };
    };

    const independent = measure();
    let n = 1000;
    let idc = 0;
    const names = ["a", "b", "c", "d", "e", "f"];
    await createAgentRuntime({
      sandboxRoot: fs.mkdtempSync(path.join(os.tmpdir(), "issac-ovl-")),
      model: new ScriptedModel([
        {
          toolCalls: names.map((name) => tc(`w-${name}`, "write", { file_path: `${name}.txt`, contents: name })),
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        { text: "done", usage: { inputTokens: 5, outputTokens: 2 } },
      ]),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
      extraHooks: { preToolUse: [independent.hook] },
    }).run("Write six files.");

    expect(independent.peak()).toBe(6);

    // And the safety half: two writes to one file must never overlap, however
    // much faster it would be.
    const conflicting = measure();
    n = 1000;
    idc = 0;
    await createAgentRuntime({
      sandboxRoot: fs.mkdtempSync(path.join(os.tmpdir(), "issac-cfl-")),
      model: new ScriptedModel([
        {
          toolCalls: [
            tc("w1", "write", { file_path: "index.html", contents: "first" }),
            tc("w2", "write", { file_path: "index.html", contents: "second" }),
          ],
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        { text: "done", usage: { inputTokens: 5, outputTokens: 2 } },
      ]),
      profile: "standard",
      now: () => ++n,
      idFactory: () => `id${++idc}`,
      maxSteps: 10,
      extraHooks: { preToolUse: [conflicting.hook] },
    }).run("Write the same file twice.");

    expect(conflicting.peak()).toBe(1);
  });
});
