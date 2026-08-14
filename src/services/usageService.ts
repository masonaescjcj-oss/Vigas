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
