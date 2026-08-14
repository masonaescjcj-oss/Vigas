import { describe, it, expect } from "vitest";
import { compactHistory, totalTokens } from "../session/compact.ts";
import type { ChatMessage } from "../session/sessionStore.ts";

function makeHistory(n: number): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  msgs.push({ id: "sys", role: "system", content: "You are Issac. ".repeat(4), createdAt: 0 });
  for (let i = 0; i < n; i++) {
    const role = i % 3 === 0 ? "user" : i % 3 === 1 ? "assistant" : "tool";
    msgs.push({
      id: `m${i}`,
      role,
      content: `Message ${i}: ${"lorem ipsum dolor sit amet ".repeat(4)}`,
      createdAt: i + 1,
      toolCallId: role === "tool" ? `call${i}` : undefined,
    });
  }
  return msgs;
}

describe("compactHistory", () => {
  const now = () => 999;
  let seq = 0;
  const idFactory = () => `sum_${++seq}`;

  it("compacts a long (50+) transcript while preserving recent turns and the system message", async () => {
    const history = makeHistory(60); // 61 messages incl. system
    expect(history.length).toBe(61);
    const before = totalTokens(history);

    const res = await compactHistory(history, { maxTokens: 200, keepRecent: 10, now, idFactory });

    expect(res.compacted).toBe(true);
    expect(res.removedCount).toBeGreaterThan(0);
    expect(res.tokensAfter).toBeLessThan(res.tokensBefore);
    expect(res.tokensBefore).toBe(before);

    // system message preserved verbatim at index 0
    expect(res.messages[0].id).toBe("sys");
    expect(res.messages[0].role).toBe("system");

    // a synthesized summary sits right after the system message
    expect(res.messages[1].role).toBe("system");
    expect(res.messages[1].content).toContain("[Compacted summary");

    // the last 10 messages are preserved verbatim, in order
    const tail = res.messages.slice(res.messages.length - 10);
    const originalTail = history.slice(history.length - 10);
    expect(tail.map((m) => m.id)).toEqual(originalTail.map((m) => m.id));

    // net result is shorter
    expect(res.messages.length).toBeLessThan(history.length);
  });

  it("does nothing when the transcript is under the token budget", async () => {
    const history = makeHistory(4);
    const res = await compactHistory(history, { maxTokens: 100000, keepRecent: 10, now, idFactory });
    expect(res.compacted).toBe(false);
    expect(res.messages.length).toBe(history.length);
  });

  it("never begins the recent window on an orphaned tool message", async () => {
    const history = makeHistory(60);
    const res = await compactHistory(history, { maxTokens: 200, keepRecent: 10, now, idFactory });
    // first non-system, non-summary message must not be a tool result
    const firstBody = res.messages[2];
    expect(firstBody.role === "tool").toBe(false);
  });
});
