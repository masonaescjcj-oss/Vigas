/**
 * Asking before building.
 *
 * On a phone the prompt is short — "make me a shop app" — and guessing the rest
 * is the biggest cause of a run that comes back wrong. Two things have to hold:
 * a malformed question must not cost the user their run, and a question the
 * agent asks must actually stop the turn rather than being answered by the
 * agent itself a step later.
 */

import { describe, expect, it } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentRuntime } from "../index.ts";
import { ScriptedModel } from "../loop.ts";
import {
  type ClarifyRequest,
  formatAnswers,
  MAX_QUESTIONS,
  OTHER_OPTION,
  optionsFor,
  parseClarifyRequest,
} from "../clarify";

const wellFormed = {
  questions: [
    {
      header: "Style",
      question: "How should it look?",
      options: [
        { label: "Minimal", description: "Lots of white space" },
        { label: "Bold", description: "Big type, strong colour" },
      ],
    },
  ],
};

describe("reading what the model asked for", () => {
  it("accepts a well-formed request", () => {
    const parsed = parseClarifyRequest(wellFormed);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.questions[0].header).toBe("Style");
    expect(parsed.request.questions[0].options).toHaveLength(2);
  });

  it("refuses with a reason instead of throwing", () => {
    // The model can correct its own arguments; the user cannot. A bad tool call
    // has to come back as a message, not end the run.
    for (const bad of [{}, { questions: [] }, { questions: "no" }, null, undefined]) {
      const parsed = parseClarifyRequest(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
    }
  });

  it("caps the number of questions so it is not an interrogation", () => {
    const many = {
      questions: Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => ({
        header: `H${i}`,
        question: `Q${i}?`,
        options: [{ label: "a" }, { label: "b" }],
      })),
    };
    const parsed = parseClarifyRequest(many);
    expect(parsed.ok).toBe(false);
  });

  it("needs at least two distinct options to be a choice", () => {
    expect(parseClarifyRequest({
      questions: [{ header: "H", question: "Q?", options: [{ label: "only" }] }],
    }).ok).toBe(false);

    // Duplicates collapse, so "two" options that are the same word are not two.
    expect(parseClarifyRequest({
      questions: [{ header: "H", question: "Q?", options: [{ label: "Same" }, { label: "same" }] }],
    }).ok).toBe(false);
  });

  it("drops an 'other' the model added itself", () => {
    // It is appended by optionsFor, always. Two of them is a bug the user sees.
    const parsed = parseClarifyRequest({
      questions: [{
        header: "H",
        question: "Q?",
        options: [{ label: "A" }, { label: "B" }, { label: "Something else" }],
      }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.questions[0].options.map((o) => o.label)).toEqual(["A", "B"]);
  });

  it("falls back to a header rather than rejecting a question over it", () => {
    const parsed = parseClarifyRequest({
      questions: [{ question: "Q?", options: [{ label: "A" }, { label: "B" }] }],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.request.questions[0].header).toBe("Question 1");
  });
});

describe("the options as shown", () => {
  it("always ends with a way out of the three choices", () => {
    // Three options are a guess at the answer space and the real answer is
    // routinely outside it. Without this the choice is a wrong option or
    // abandoning the flow.
    const parsed = parseClarifyRequest(wellFormed);
    if (!parsed.ok) throw new Error("fixture should parse");
    const shown = optionsFor(parsed.request.questions[0]);
    expect(shown).toHaveLength(3);
    expect(shown[shown.length - 1]).toEqual(OTHER_OPTION);
  });
});

describe("handing the answers back", () => {
  const request: ClarifyRequest = {
    questions: [
      { header: "Style", question: "How should it look?", options: [{ label: "Minimal" }] },
      { header: "Auth", question: "Do users sign in?", options: [{ label: "Yes" }] },
    ],
  };

  it("labels each answer with the question it answers", () => {
    const text = formatAnswers(request, [
      { header: "Style", question: "How should it look?", answer: "Minimal" },
      { header: "Auth", question: "Do users sign in?", answer: "No accounts" },
    ]);
    expect(text).toContain("- Style: Minimal");
    expect(text).toContain("- Auth: No accounts");
  });

  it("says a question was skipped rather than dropping it", () => {
    // Silence and "no preference" are different, and the agent should know
    // which one it got — otherwise it reads the gap as the question never
    // having been asked.
    const text = formatAnswers(request, [
      { header: "Style", question: "How should it look?", answer: "Minimal" },
    ]);
    expect(text).toContain("- Auth: (skipped");
  });

  it("reads as something the user said, so the agent acts on it", () => {
    const text = formatAnswers(request, []);
    expect(text).toContain("Go ahead and build it");
  });
});

/**
 * The tool driving the real runtime.
 *
 * The unit tests above cover the shapes; this covers the thing that actually
 * has to happen — the turn *ends*. Without a stop signal the loop feeds the
 * tool result straight back to the model, which then answers its own question
 * and builds on the guess it was supposed to avoid.
 */
describe("ask_user in a run", () => {
  function runtimeThatAsks(turns: Array<Record<string, unknown>>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "retro-clarify-"));
    let n = 0;
    let idc = 0;
    return createAgentRuntime({
      sandboxRoot: root,
      model: new ScriptedModel(turns as never),
      now: () => ++n,
      idFactory: () => `c${++idc}`,
    });
  }

  const askCall = {
    toolCalls: [{
      id: "t1",
      name: "ask_user",
      input: {
        questions: [{
          header: "Style",
          question: "How should it look?",
          options: [{ label: "Minimal" }, { label: "Bold" }],
        }],
      },
    }],
  };

  it("ends the turn instead of letting the agent answer itself", async () => {
    // The scripted model would happily keep going — "Built it!" is queued as the
    // next turn. It must never be reached.
    const runtime = runtimeThatAsks([askCall, { text: "Built it!" }]);
    const result = await runtime.run("make me a shop app");

    expect(result.stoppedReason).toBe("awaiting-input");
    expect(result.finalText).not.toBe("Built it!");
  });

  it("returns the question so the caller can show it", async () => {
    const runtime = runtimeThatAsks([askCall, { text: "Built it!" }]);
    const result = await runtime.run("make me a shop app");

    expect(result.pendingQuestion?.questions).toHaveLength(1);
    expect(result.pendingQuestion?.questions[0].question).toBe("How should it look?");
  });

  it("leaves the session resumable, not completed", async () => {
    // The answer continues this session, so a status of "completed" would send
    // the user to a fork instead of an answer.
    const runtime = runtimeThatAsks([askCall, { text: "Built it!" }]);
    const result = await runtime.run("make me a shop app");
    expect(result.session.status).toBe("paused");
  });

  it("a malformed question costs a step, not the run", async () => {
    const runtime = runtimeThatAsks([
      { toolCalls: [{ id: "t1", name: "ask_user", input: { questions: [] } }] },
      { text: "Fine, I built it." },
    ]);
    const result = await runtime.run("make me a shop app");

    // The tool reported the problem to the model, which carried on.
    expect(result.stoppedReason).toBe("final");
    expect(result.finalText).toBe("Fine, I built it.");
  });

  it("finishes the other tool calls in the same round first", async () => {
    // The question is checked after the round, so a read issued alongside it
    // still lands in the transcript and is there when the answer arrives.
    const runtime = runtimeThatAsks([{
      toolCalls: [
        { id: "t1", name: "list_dir", input: { path: "." } },
        askCall.toolCalls[0],
      ],
    }, { text: "Built it!" }]);
    const result = await runtime.run("make me a shop app");

    expect(result.stoppedReason).toBe("awaiting-input");
    const toolMessages = result.session.messages.filter((m) => m.role === "tool");
    expect(toolMessages).toHaveLength(2);
  });
});
