/**
 * supabase/functions/shared/youcomFormat.ts
 * ---------------------------------------------------------------------------
 * Turning a You.com agent reply into something the chat can draw.
 *
 * The Agents API answers in full Markdown — `####` headings and citations as
 * inline links, `[[1]](https://…)` — and the app's message renderer draws code,
 * inline code and bold, nothing else. Left alone, a web-grounded answer arrives
 * as a wall of hashes and bracketed URLs. So:
 *
 *   #### Heading          →  **Heading**
 *   [[1]](https://a.com)  →  [1]            and a numbered source list at the end
 *   [text](https://a.com) →  text
 *
 * The source list takes its titles from the search results the agent returned
 * with the answer, so a citation reads "[1] Formula 1 on ESPN — espn.com"
 * rather than a bare URL.
 *
 * Pure — no Deno or network — so it is tested directly.
 * ---------------------------------------------------------------------------
 */

export interface YoucomSource {
  url: string;
  title?: string;
}

/** A conversation turn as the rest of the backend holds it. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The Agents API's input. One question goes as a string; a conversation goes
 * as messages whose roles are "user" and "agent" — it rejects "assistant".
 */
export function toYoucomInput(turns: ChatTurn[]): string | Array<{ role: "user" | "agent"; content: string }> {
  if (turns.length === 1) return turns[0].content;
  return turns.map((t) => ({ role: t.role === "assistant" ? "agent" : "user", content: t.content }));
}

interface OutputItem {
  type?: string;
  text?: unknown;
  content?: unknown;
}

/**
 * The answer text and the search results out of an agent run's `output`.
 * Unknown item types are ignored rather than treated as errors: the API adds
 * kinds, and an answer should not fail because a new one appeared beside it.
 */
export function readOutput(output: unknown): { text: string; results: YoucomSource[] } {
  let text = "";
  const results: YoucomSource[] = [];
  if (!Array.isArray(output)) return { text, results };

  for (const raw of output as OutputItem[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.type === "message.answer" && typeof raw.text === "string") {
      text += (text ? "\n\n" : "") + raw.text;
    } else if (typeof raw.type === "string" && raw.type.includes("search") && Array.isArray(raw.content)) {
      for (const hit of raw.content as Array<Record<string, unknown>>) {
        const url = typeof hit?.url === "string" ? hit.url : typeof hit?.citation_uri === "string" ? hit.citation_uri : null;
        if (!url) continue;
        results.push({ url, title: typeof hit.title === "string" ? hit.title : undefined });
      }
    }
  }
  return { text: text.trim(), results };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Rewrite the agent's Markdown into the subset the app draws, and collect the
 * cited sources in the order they were cited.
 */
export function tidyAnswer(text: string, results: YoucomSource[] = []): { text: string; sources: Array<YoucomSource & { n: number }> } {
  const titleByUrl = new Map(results.map((r) => [r.url, r.title]));
  const cited = new Map<string, number>();

  let out = text
    // Citations first, before the general link rule swallows them.
    .replace(/\[\[(\d+)\]\]\((https?:\/\/[^\s)]+)\)/g, (_m, n: string, url: string) => {
      if (!cited.has(url)) cited.set(url, Number(n));
      return `[${cited.get(url)}]`;
    })
    // Any remaining link keeps its words and drops the URL.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    // Headings become a bold line; the renderer has no heading style.
    // Spaces and tabs only: `\s` would match the newline and eat the blank
    // line that separates the heading from its paragraph.
    .replace(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "**$1**")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sources = [...cited.entries()]
    .map(([url, n]) => ({ n, url, title: titleByUrl.get(url) }))
    .sort((a, b) => a.n - b.n);

  if (sources.length) {
    const lines = sources.map((s) => `[${s.n}] ${s.title ? `${s.title} — ` : ""}${domainOf(s.url)}`);
    out += `\n\n**Sources**\n${lines.join("\n")}`;
  }
  return { text: out, sources };
}
