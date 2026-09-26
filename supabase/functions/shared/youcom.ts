/**
 * supabase/functions/shared/youcom.ts
 * ---------------------------------------------------------------------------
 * You.com's Agents API, as Chat's engine.
 *
 * What was measured against the real API on 2026-09-26, and what it decides:
 *
 *   - POST api.you.com/v1/agents/runs with agent "express" answers in about
 *     two seconds, in the language it is asked in, and takes a conversation.
 *   - Given the `web_search` tool it searches first and cites what it found.
 *     Without it, it answers from memory and says it has no results.
 *   - Its OpenAI-compatible endpoint (/v1/chat/completions) refuses a
 *     platform key like ours: "API key tenant does not have access to this
 *     service". So this is its own adapter, not another OpenAI base URL.
 *   - It has no function calling. It can answer; it cannot drive Build, which
 *     writes files and runs commands through tools. So it is Chat-only, and
 *     a You.com key is kept out of every path that expects OpenAI.
 *   - api.you.com is behind Cloudflare, which blocks some networks outright.
 *     The edge functions and the build server reach it; a laptop in some
 *     countries does not.
 *
 * Where the key comes from, first match wins:
 *   1. the user's own, added under "Your AI providers" (they pay for it)
 *   2. the operator's pool (admin panel), so it can be swapped without a deploy
 *   3. the YOUCOM_API_KEY secret
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret } from "./secretBox.ts";
import { isRested, orderKeys, type PoolKey } from "./keyPool.ts";
import { readOutput, tidyAnswer, toYoucomInput, type ChatTurn, type YoucomSource } from "./youcomFormat.ts";

export const YOUCOM_BASE_URL = "https://api.you.com";
const AGENT_RUNS = `${YOUCOM_BASE_URL}/v1/agents/runs`;

/** Catalogue id → the agent name the API expects. */
const AGENTS: Record<string, string> = {
  "youcom-express": "express",
};

export const DEFAULT_YOUCOM_MODEL = "youcom-express";

export function isYoucomModel(id: unknown): boolean {
  return typeof id === "string" && id in AGENTS;
}

/** A base URL on you.com — these keys speak the Agents API, not OpenAI's. */
export function isYoucomUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "you.com" || host.endsWith(".you.com");
  } catch {
    return false;
  }
}

export class YoucomError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** A readable message out of whatever the API sent back. */
function describe(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message ?? parsed?.detail?.[0]?.msg ?? parsed?.detail ?? parsed?.message;
    if (typeof msg === "string" && msg) return `${status}: ${msg}`;
  } catch { /* not JSON */ }
  // Cloudflare's block page is HTML; say what it is rather than print it.
  if (/cloudflare/i.test(body)) return `${status}: blocked by You.com's firewall for this network`;
  return `${status}: ${body.slice(0, 200)}`;
}

export async function runYoucomAgent(
  apiKey: string,
  turns: ChatTurn[],
  model: string = DEFAULT_YOUCOM_MODEL,
): Promise<{ text: string; sources: Array<YoucomSource & { n: number }> }> {
  let response: Response;
  try {
    response = await fetch(AGENT_RUNS, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        agent: AGENTS[model] ?? "express",
        input: toYoucomInput(turns),
        stream: false,
        // Without this Express answers from memory and says it has no results.
        tools: [{ type: "web_search" }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new YoucomError(0, `Could not reach You.com: ${error instanceof Error ? error.message : String(error)}`);
  }

  const body = await response.text();
  if (!response.ok) throw new YoucomError(response.status, describe(response.status, body));

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new YoucomError(502, "You.com sent back something that is not JSON.");
  }
  const { text, results } = readOutput((parsed as { output?: unknown })?.output);
  if (!text) throw new YoucomError(502, "You.com returned an empty answer.");
  return tidyAnswer(text, results);
}

/** One tiny run, to prove a key works before it is saved or relied on. */
export async function probeYoucom(apiKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const response = await fetch(AGENT_RUNS, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ agent: "express", input: "Reply with the single word: ok", stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return { ok: true, status: response.status, detail: "" };
    return { ok: false, status: response.status, detail: describe(response.status, await response.text().catch(() => "")) };
  } catch (error) {
    return { ok: false, status: 0, detail: `Could not reach You.com: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export interface YoucomKey {
  apiKey: string;
  label: string;
  source: "user" | "pool" | "env";
  /** Set for a pool key, so its health can be recorded. */
  poolId?: string;
}

interface OwnRow {
  base_url: string;
  key_cipher: string;
  label: string;
}

/** The user's verified providers, split into You.com and everything else. */
export async function readOwnProviders(
  service: SupabaseClient,
  userId: string,
): Promise<{ youcom: OwnRow | null; hasOpenAI: boolean }> {
  const { data, error } = await service
    .from("user_providers")
    .select("base_url,key_cipher,label")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .order("created_at", { ascending: true });
  if (error || !data) return { youcom: null, hasOpenAI: false };
  const rows = data as OwnRow[];
  return {
    youcom: rows.find((r) => isYoucomUrl(r.base_url)) ?? null,
    hasOpenAI: rows.some((r) => !isYoucomUrl(r.base_url)),
  };
}

export async function resolveYoucomKey(service: SupabaseClient, own: OwnRow | null): Promise<YoucomKey | null> {
  if (own) {
    try {
      return { apiKey: await openSecret(own.key_cipher), label: own.label, source: "user" };
    } catch { /* undecryptable: fall through to the operator's key */ }
  }

  try {
    const { data } = await service
      .from("platform_providers")
      .select("id,label,base_url,key_cipher,model,priority,is_active,last_used_at,exhausted_at,failure_count")
      .eq("is_active", true);
    const now = Date.now();
    const pool = orderKeys(((data ?? []) as unknown as PoolKey[]).filter((k) => isYoucomUrl(k.base_url)), now);
    for (const key of pool) {
      if (!isRested(key, now)) continue;
      try {
        return { apiKey: await openSecret(key.key_cipher), label: key.label, source: "pool", poolId: key.id };
      } catch { /* try the next */ }
    }
  } catch { /* pool unreadable: fall through */ }

  const env = Deno.env.get("YOUCOM_API_KEY");
  return env ? { apiKey: env, label: "You.com", source: "env" } : null;
}

/**
 * Which engine answers this chat message.
 *
 * You.com when it was asked for by name, or when the picker is on Auto and the
 * user has not brought an OpenAI-compatible key of their own (someone who pays
 * for their own model chose it). Otherwise the OpenAI path, unchanged.
 */
export async function chooseChatEngine(
  service: SupabaseClient,
  userId: string,
  requested: string | null | undefined,
): Promise<{ kind: "youcom"; key: YoucomKey; model: string } | { kind: "openai" }> {
  const named = isYoucomModel(requested);
  const auto = !requested || requested === "auto";
  if (!named && !auto) return { kind: "openai" };

  const own = await readOwnProviders(service, userId);
  if (auto && own.hasOpenAI && !own.youcom) return { kind: "openai" };

  const key = await resolveYoucomKey(service, own.youcom);
  if (!key) return { kind: "openai" };
  return { kind: "youcom", key, model: named ? String(requested) : DEFAULT_YOUCOM_MODEL };
}
