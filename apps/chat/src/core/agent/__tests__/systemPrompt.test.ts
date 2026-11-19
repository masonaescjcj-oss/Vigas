import { describe, it, expect } from "vitest";
import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "../systemPrompt.ts";

const BACKSLASH = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);

describe("the system prompt renders as prose, not as source", () => {
  it("has no leftover escape characters", () => {
    // The prompt is one long template literal, so every backtick meant for the
    // model has to be escaped in the source. Miss one and the file stops
    // compiling — loud, easy. Escape one that did not need it and the model is
    // quietly shown a stray backslash instead of an inline code span. That is
    // silent, and it is on every request.
    const stray = DEFAULT_SYSTEM_PROMPT.split("\n").filter((line) =>
      line.includes(BACKSLASH + BACKTICK)
    );
    expect(stray, `lines with a literal ${BACKSLASH}${BACKTICK}: ${stray.join(" | ")}`).toEqual([]);
  });

  it("mentions the tools it was given, not a hard-coded list", () => {
    const prompt = buildSystemPrompt({ toolNames: ["read", "write", "teleport"] });
    expect(prompt).toContain("teleport");
  });

  it("tells the agent what a backend is in this product", () => {
    // Without this the agent has no reason to think a backend is possible, and
    // a request for "a shop with a backend" produces a static page.
    expect(DEFAULT_SYSTEM_PROMPT).toContain("What a backend means here");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Supabase");
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/service-role key must never appear/i);
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/Row Level Security/i);
  });

  it("describes subagents the way they actually behave", () => {
    // They share the parent's workspace and run one at a time. A model told
    // otherwise fans out overlapping edits.
    expect(DEFAULT_SYSTEM_PROMPT).not.toMatch(/isolated worktree/i);
  });
});
