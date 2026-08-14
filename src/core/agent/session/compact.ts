/**
 * session/compact.ts
 * ---------------------------------------------------------------------------
 * History compaction. When a transcript approaches the model's context limit,
 * we summarize the older turns into a single compact "summary" message and keep
 * the most recent turns verbatim. This preserves continuity while cutting token
 * count.
 *
 * Invariants:
 *   - A leading system message (index 0) is always preserved as-is.
 *   - The most recent `keepRecent` messages are preserved verbatim.
 *   - Everything between them is replaced by one summary message.
 *   - Tool results are never left orphaned: if the recent window would start on
 *     a `tool` message, we extend it backward to include its assistant call.
 * ---------------------------------------------------------------------------
 */

import type { ChatMessage } from "./sessionStore.ts";

/** Cheap, dependency-free token estimate (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function messageTokens(m: ChatMessage): number {
  let t = m.tokens ?? estimateTokens(m.content);
  if (m.toolCalls) t += estimateTokens(JSON.stringify(m.toolCalls));
  return t;
}

export function totalTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + messageTokens(m), 0);
}

/** Summarizes a run of messages into plain text. Pluggable (LLM in prod). */
export type Summarizer = (messages: ChatMessage[]) => Promise<string> | string;

/**
 * A deterministic, offline summarizer suitable for tests and as a safe
 * fallback: it produces a structured digest of the folded messages.
 */
export const deterministicSummarizer: Summarizer = (messages) => {
  const userAsks = messages.filter((m) => m.role === "user").length;
  const toolRuns = messages.filter((m) => m.role === "tool").length;
  const tools = new Map<string, number>();
  for (const m of messages) {
    for (const tc of m.toolCalls ?? []) tools.set(tc.name, (tools.get(tc.name) ?? 0) + 1);
  }
  const toolList = [...tools.entries()].map(([n, c]) => `${n}×${c}`).join(", ") || "none";
  const firstUser = messages.find((m) => m.role === "user")?.content.slice(0, 200) ?? "";
  const lastAssistant =
    [...messages].reverse().find((m) => m.role === "assistant" && m.content)?.content.slice(0, 200) ?? "";
  return [
    `[Compacted summary of ${messages.length} earlier messages]`,
    `User requests: ${userAsks}. Tool executions: ${toolRuns} (${toolList}).`,
    firstUser && `Initial request: ${firstUser}`,
    lastAssistant && `Most recent assistant state: ${lastAssistant}`,
  ]
    .filter(Boolean)
    .join("\n");
};

export interface CompactionOptions {
  /** Compact only when total estimated tokens exceed this. */
  maxTokens: number;
  /** Number of most-recent messages to always keep verbatim. */
  keepRecent: number;
  summarizer?: Summarizer;
  /** Injected clock + id for the synthesized summary message. */
  now: () => number;
  idFactory: () => string;
}

export interface CompactionResult {
  messages: ChatMessage[];
  compacted: boolean;
  removedCount: number;
  tokensBefore: number;
  tokensAfter: number;
}

export async function compactHistory(
  messages: ChatMessage[],
  opts: CompactionOptions,
): Promise<CompactionResult> {
  const tokensBefore = totalTokens(messages);
  const hasSystem = messages.length > 0 && messages[0].role === "system";
  const systemPart = hasSystem ? [messages[0]] : [];
  const body = hasSystem ? messages.slice(1) : messages;

  if (tokensBefore <= opts.maxTokens || body.length <= opts.keepRecent) {
    return { messages, compacted: false, removedCount: 0, tokensBefore, tokensAfter: tokensBefore };
  }

  // Determine the recent window, extending backward so it never begins on a
  // tool result whose assistant call was folded away.
  let splitAt = body.length - opts.keepRecent;
  while (splitAt > 0 && body[splitAt].role === "tool") splitAt--;

  const toFold = body.slice(0, splitAt);
  const recent = body.slice(splitAt);
  if (toFold.length === 0) {
    return { messages, compacted: false, removedCount: 0, tokensBefore, tokensAfter: tokensBefore };
  }

  const summarizer = opts.summarizer ?? deterministicSummarizer;
  const summaryText = await summarizer(toFold);
  const summaryMessage: ChatMessage = {
    id: opts.idFactory(),
    role: "system",
    content: summaryText,
    createdAt: opts.now(),
    tokens: estimateTokens(summaryText),
  };

  const next = [...systemPart, summaryMessage, ...recent];
  const tokensAfter = totalTokens(next);
  return {
    messages: next,
    compacted: true,
    removedCount: toFold.length,
    tokensBefore,
    tokensAfter,
  };
}
