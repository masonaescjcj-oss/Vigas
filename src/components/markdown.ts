/**
 * frontend/src/components/markdown.ts
 * ---------------------------------------------------------------------------
 * The small slice of Markdown agent replies actually use. Kept as plain logic
 * (no JSX) so it can be unit-tested directly — the renderer in
 * AgentMessageText.tsx only turns these blocks into views.
 * ---------------------------------------------------------------------------
 */

export type Block =
  | { type: "text"; value: string }
  | { type: "code"; value: string; lang?: string };

/** Split a message into prose and fenced code blocks. */
export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(content)) !== null) {
    if (match.index > cursor) blocks.push({ type: "text", value: content.slice(cursor, match.index) });
    blocks.push({ type: "code", value: match[2].replace(/\n$/, ""), lang: match[1] || undefined });
    cursor = match.index + match[0].length;
  }
  if (cursor < content.length) blocks.push({ type: "text", value: content.slice(cursor) });
  return blocks.filter((b) => (b.type === "code" ? true : b.value.trim().length > 0));
}
