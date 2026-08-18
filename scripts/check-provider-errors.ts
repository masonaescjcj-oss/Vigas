/**
 * scripts/check-provider-errors.ts
 * ---------------------------------------------------------------------------
 * Checking classifyFailure against what the provider really answers.
 *
 * This decides whether a key is spent, and spent keys get a 30-minute cooldown.
 * Its unit tests only ever saw error bodies I wrote myself, and two of them were
 * wrong about reality: a missing model arrives as 403 (read as "key dead", which
 * rested every key in the pool in turn), and a malformed request arrives as 500
 * (read as "provider down", which toured the whole pool paying for a request
 * that could never succeed).
 *
 * Sends four tiny requests. Costs a handful of tokens.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-provider-errors.ts
 * ---------------------------------------------------------------------------
 */
import { classifyFailure, type FailureKind } from "../supabase/functions/shared/keyPool.ts";

const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

if (!KEY) {
  console.log("SKIP  OPENAI_API_KEY is not set, so the provider cannot be asked.");
  Deno.exit(0);
}

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(detail).slice(0, 300)}`}`);
  if (!ok) Deno.exitCode = 1;
}

async function ask(key: string, body: unknown): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

const cases: Array<{ name: string; key: string; body: unknown; want: FailureKind; why: string }> = [
  {
    name: "a rejected key",
    key: "sk-definitely-not-a-real-key-000",
    body: { model: MODEL, messages: [{ role: "user", content: "hi" }], max_tokens: 1 },
    want: "key_exhausted",
    why: "the pool must rotate past a dead key",
  },
  {
    name: "a model this key cannot serve",
    key: KEY,
    body: { model: "totally-not-a-model-xyz", messages: [{ role: "user", content: "hi" }], max_tokens: 1 },
    want: "model_unavailable",
    why: "another key may carry it, but this key is healthy and must not be rested",
  },
  {
    name: "a request we built wrong",
    key: KEY,
    body: { model: MODEL, messages: "should be an array", max_tokens: 1 },
    want: "request_rejected",
    why: "no key can ever satisfy it, so touring the pool only costs money",
  },
];

for (const item of cases) {
  const result = await ask(item.key, item.body);
  if (result.status === 0) {
    console.log(`SKIP  ${item.name} — the provider was unreachable`);
    continue;
  }
  const got = classifyFailure(result.status, result.body);
  check(
    `${item.name}: ${result.status} -> ${got} (${item.why})`,
    got === item.want,
    `wanted ${item.want}, body: ${result.body.replace(/\s+/g, " ").slice(0, 200)}`,
  );
}

// Control: a sane request must actually succeed, or the cases above prove nothing
// about this provider.
const ok = await ask(KEY, { model: MODEL, messages: [{ role: "user", content: "say ok" }], max_tokens: 3 });
check(`a sane request succeeds (${ok.status}) — otherwise the above means nothing`, ok.status === 200,
  ok.body.slice(0, 200));
