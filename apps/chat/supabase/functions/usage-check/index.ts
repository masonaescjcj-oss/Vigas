import { withSentryHandler } from "../shared/sentry.ts";
import { EmptyInputSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { checkUsage } from "../shared/usage.ts";
import { planQuota, type QuotaKind } from "../shared/quota.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface QuotaReading {
  used: number;
  /** Null is unlimited. */
  limit: number | null;
  window_hours: number;
  /** When a slot frees up — only known, and only asked for, when the window is full. */
  next_free_at: string | null;
}

/**
 * How much of each rolling window has been used — the numbers the Usage
 * screen's gauges show. The same RPCs enforceQuota reads, so what the gauge
 * says and what the next request is refused on cannot disagree.
 *
 * Null rather than an error when counting fails: the token figures in the
 * same response are still worth showing, and a gauge that is missing is
 * better than a Usage screen that will not open.
 */
async function readQuota(service: SupabaseClient, userId: string, tier: string): Promise<Record<QuotaKind, QuotaReading> | null> {
  try {
    const plan = await planQuota(service, tier);
    const out = {} as Record<QuotaKind, QuotaReading>;
    for (const kind of ["build", "chat"] as const) {
      const limit = kind === "build" ? plan.buildsPerWindow : plan.chatPerWindow;
      const { data: usedRaw, error } = await service.rpc("quota_used", {
        p_user_id: userId,
        p_kind: kind,
        p_window_hours: plan.windowHours,
      });
      if (error) return null;
      const used = Number(usedRaw ?? 0);
      let nextFreeAt: string | null = null;
      if (limit !== null && used >= limit) {
        const { data: nextRaw } = await service.rpc("quota_next_free_at", {
          p_user_id: userId,
          p_kind: kind,
          p_window_hours: plan.windowHours,
          p_limit: limit,
        });
        nextFreeAt = nextRaw ? new Date(String(nextRaw)).toISOString() : null;
      }
      out[kind] = { used, limit, window_hours: plan.windowHours, next_free_at: nextFreeAt };
    }
    return out;
  } catch {
    return null;
  }
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["GET", "POST"]);
    const { user } = await requireUser(req);
    if (req.method === "POST") await parseJson(req, EmptyInputSchema);
    else EmptyInputSchema.parse({});
    const service = createServiceClient();
    await enforceRateLimit(service, "usage-check", user.id, 120);
    const result = await checkUsage(service, user.id);
    const quota = await readQuota(service, user.id, result.tier);
    return json({
      allowed: true,
      tier: result.tier,
      usage: result.meter,
      remaining_tokens: Math.max(0, result.meter.plan_limit_tokens - result.meter.tokens_used),
      quota,
    }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("usage-check", handler));
}
