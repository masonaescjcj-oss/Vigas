/**
 * scripts/check-tool-calling.ts
 * ---------------------------------------------------------------------------
 * Checking the agent's core loop against the real provider.
 *
 * Everything the Build mode does rests on one contract: the provider returns tool
 * calls at `choices[0].message.tool_calls[]`, with `function.arguments` as a JSON
 * string, and accepts an `assistant`+`tool_calls` / `tool`-result exchange on the
 * next turn. If any part of that differs, the agent cannot use tools at all — and
 * no unit test would notice, because the tests supply the responses themselves.
 *
 * Two real requests, a handful of tokens.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-tool-calling.ts
 * ---------------------------------------------------------------------------
 */
import { parseToolArguments } from "../supabase/functions/shared/agentRuntime.ts";

const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

if (!KEY) {
  console.log("SKIP  OPENAI_API_KEY is not set, so the provider cannot be asked.");
  Deno.exit(0);
}

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300)}`}`);
  if (!ok) Deno.exitCode = 1;
}

/** Shaped exactly as agentRuntime formats its tool registry. */
const TOOLS = [{
  type: "function",
  function: {
    name: "write",
    description: "Write a file to the project.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
        content: { type: "string", description: "Full file contents" },
      },
      required: ["path", "content"],
    },
  },
}];

async function ask(messages: unknown[]): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.2, messages, tools: TOOLS }),
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ── Turn one: the model should choose the tool.
const first = await ask([
  { role: "system", content: "You are a coding agent. Use the tools to do the work." },
  { role: "user", content: "Create index.html containing exactly: <h1>Hi</h1>" },
]);

check(`the provider accepts a tools array (${first.status})`, first.status === 200, first.data);
const choice = first.data?.choices?.[0];
const calls = choice?.message?.tool_calls;

check("it answers with tool_calls where agentRuntime looks", Array.isArray(calls) && calls.length > 0, choice);
if (!Array.isArray(calls) || calls.length === 0) {
  console.log("\nWithout tool calls the agent cannot build anything; stopping here.");
  Deno.exit(Deno.exitCode ?? 1);
}

const call = calls[0];
check(`the tool is named (${call.function?.name})`, call.function?.name === "write", call);
check("the call carries an id, needed to answer it", typeof call.id === "string" && call.id.length > 0, call);
check(
  `arguments arrive as a JSON string, not an object (${typeof call.function?.arguments})`,
  typeof call.function?.arguments === "string",
  call.function,
);

// The real point: the arguments survive our parser with content intact.
let parsed: Record<string, unknown> = {};
try {
  parsed = parseToolArguments(call.function?.name, call.function?.arguments);
} catch (error) {
  check("parseToolArguments reads them", false, error instanceof Error ? error.message : error);
}
check("the parsed arguments include the file path", typeof parsed.path === "string" && !!parsed.path, parsed);
check("and the file content, not an empty object", typeof parsed.content === "string" && !!parsed.content, parsed);

check(`finish_reason says tools were requested (${choice?.finish_reason})`, choice?.finish_reason === "tool_calls");
check(
  "usage is reported under the names the meter reads",
  Number.isFinite(first.data?.usage?.prompt_tokens) && Number.isFinite(first.data?.usage?.completion_tokens),
  first.data?.usage,
);

// ── Turn two: hand the result back, exactly as agentRuntime formats it.
const second = await ask([
  { role: "system", content: "You are a coding agent. Use the tools, then say what you did in one sentence." },
  { role: "user", content: "Create index.html containing exactly: <h1>Hi</h1>" },
  {
    role: "assistant",
    content: null,
    tool_calls: [{
      id: call.id,
      type: "function",
      function: { name: call.function.name, arguments: JSON.stringify(parsed) },
    }],
  },
  { role: "tool", tool_call_id: call.id, content: "Wrote index.html (11 bytes)." },
]);

check(`the provider accepts the tool-result exchange (${second.status})`, second.status === 200, second.data);
const final = second.data?.choices?.[0];
check(
  "it finishes with text instead of looping on tools forever",
  typeof final?.message?.content === "string" && final.message.content.length > 0,
  final,
);
check(`finish_reason is a normal stop (${final?.finish_reason})`, final?.finish_reason === "stop");
