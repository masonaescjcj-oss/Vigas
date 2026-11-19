/**
 * parseBlocks drives how every agent reply renders. A regression here shows the
 * user raw ``` fences (which is exactly the bug this parser was written to fix).
 */
import { describe, expect, it } from "vitest";
import { parseBlocks, type Block } from "../markdown";

describe("parseBlocks", () => {
  it("returns a single text block for plain prose", () => {
    const blocks = parseBlocks("Just a sentence.");
    expect(blocks).toEqual([{ type: "text", value: "Just a sentence." }]);
  });

  it("extracts a fenced code block and its language", () => {
    const blocks = parseBlocks("Here:\n```js\nconst a = 1;\n```");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "text" });
    expect(blocks[1]).toMatchObject({ type: "code", lang: "js", value: "const a = 1;" });
  });

  it("handles a fence with no language", () => {
    const [block] = parseBlocks("```\nplain\n```");
    expect(block).toMatchObject({ type: "code", value: "plain" });
    expect((block as { lang?: string }).lang).toBeUndefined();
  });

  it("keeps text on both sides of a fence", () => {
    const blocks = parseBlocks("before\n```\ncode\n```\nafter");
    expect(blocks.map((b: Block) => b.type)).toEqual(["text", "code", "text"]);
    expect(blocks[2].value.trim()).toBe("after");
  });

  it("handles multiple fences", () => {
    const blocks = parseBlocks("```a\n1\n```\ntext\n```b\n2\n```");
    expect(blocks.filter((b: Block) => b.type === "code")).toHaveLength(2);
  });

  it("preserves blank lines inside a code block", () => {
    const [block] = parseBlocks("```\nline1\n\nline3\n```");
    expect(block.value).toBe("line1\n\nline3");
  });

  it("drops whitespace-only prose between fences", () => {
    const blocks = parseBlocks("```\na\n```\n\n```\nb\n```");
    expect(blocks.every((b: Block) => b.type === "code")).toBe(true);
  });

  it("leaves an unterminated fence as text rather than swallowing the reply", () => {
    const blocks = parseBlocks("start ```js\nnever closed");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });

  it("returns nothing for an empty message", () => {
    expect(parseBlocks("")).toEqual([]);
  });
});
