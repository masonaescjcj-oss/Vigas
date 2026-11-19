import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingPromptStore } from "../pendingPromptStore";

describe("pendingPromptStore", () => {
  beforeEach(() => {
    usePendingPromptStore.getState().clearPendingPrompt();
  });

  it("stores and consumes a pending prompt exactly once", () => {
    usePendingPromptStore.getState().setPendingPrompt({
      prompt: "What is the cheapest coding model?",
      mode: "chat",
      model: "vigas/auto",
    });

    const first = usePendingPromptStore.getState().consumePendingPrompt();
    expect(first).toMatchObject({
      prompt: "What is the cheapest coding model?",
      mode: "chat",
      model: "vigas/auto",
    });

    expect(usePendingPromptStore.getState().consumePendingPrompt()).toBeNull();
  });

  it("drops stale prompts older than 30 minutes", () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    usePendingPromptStore.getState().setPendingPrompt({
      prompt: "Build a landing page",
      mode: "build",
      model: "auto",
    });
    spy.mockReturnValue(now + 31 * 60 * 1000);
    expect(usePendingPromptStore.getState().consumePendingPrompt()).toBeNull();
    spy.mockRestore();
  });
});
