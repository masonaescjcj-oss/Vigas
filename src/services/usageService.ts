/**
 * frontend/src/services/usageService.ts
 * ---------------------------------------------------------------------------
 * Real token usage from the usage-check edge function (usage_metering table).
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export interface UsageSummary {
  tier: string;
  tokensUsed: number;
  tokenLimit: number;
  requests: number;
  remaining: number;
  periodEnd?: string;
}

/** One rolling window: builds or chat messages. */
export interface QuotaReading {
  used: number;
  /** Null is unlimited. */
  limit: number | null;
  windowHours: number;
  /** Only set when the window is full: when the next one frees up. */
  nextFreeAt: string | null;
}

/**
 * The rolling build and message counts, or null when the server did not send
 * them — an older usage-check that predates the field, or a count that failed.
 * The caller shows the token figures alone in that case.
 */
export async function getQuota(): Promise<{ build: QuotaReading; chat: QuotaReading } | null> {
  const raw = await invokeFunction<Record<string, any>>("usage-check", { method: "POST" });
  const q = raw?.quota;
  if (!q || !q.build || !q.chat) return null;
  const read = (r: any): QuotaReading => ({
    used: Number(r.used ?? 0),
    limit: r.limit === null || r.limit === undefined ? null : Number(r.limit),
    windowHours: Number(r.window_hours ?? 12),
    nextFreeAt: r.next_free_at ?? null,
  });
  return { build: read(q.build), chat: read(q.chat) };
}

export async function getUsage(): Promise<UsageSummary> {
  const raw = await invokeFunction<Record<string, any>>("usage-check", { method: "POST" });
  const usage = raw.usage ?? raw;
  const tokensUsed = Number(usage.tokens_used ?? usage.tokensUsed ?? 0);
  const tokenLimit = Number(usage.plan_limit_tokens ?? usage.limit ?? raw.limit ?? 0);
  return {
    tier: String(raw.tier ?? raw.subscription_tier ?? "free"),
    tokensUsed,
    tokenLimit,
    requests: Number(usage.requests_count ?? usage.requests ?? 0),
    remaining: Number(raw.remaining ?? Math.max(0, tokenLimit - tokensUsed)),
    periodEnd: usage.period_end ?? undefined,
  };
}
