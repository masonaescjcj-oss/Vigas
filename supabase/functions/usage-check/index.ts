import { withSentryHandler } from "../shared/sentry.ts";
import { EmptyInputSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { checkUsage } from "../shared/usage.ts";

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
    return json({ allowed: true, tier: result.tier, usage: result.meter, remaining_tokens: Math.max(0, result.meter.plan_limit_tokens - result.meter.tokens_used) }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("usage-check", handler));
}
