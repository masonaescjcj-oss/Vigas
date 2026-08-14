import { withSentryHandler, withSentrySpan } from "../../../src/infra/monitoring/sentryConfig.ts";
import { RevenueCatWebhookSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { clientIp, constantTimeEqual, corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { applyRevenueCatEvent } from "../shared/revenuecat.ts";

async function requireRevenueCatAuthorization(req: Request): Promise<void> {
  const actual = req.headers.get("authorization") ?? "";
  if (!actual) throw new AppError(401, "INVALID_WEBHOOK_AUTH", "RevenueCat webhook authorization is invalid.");
  const configured = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!configured) throw new AppError(500, "SERVER_MISCONFIGURED", "REVENUECAT_WEBHOOK_AUTH is not configured.");
  const expected = configured.toLowerCase().startsWith("bearer ") ? configured : `Bearer ${configured}`;
  if (!(await constantTimeEqual(actual, expected))) throw new AppError(401, "INVALID_WEBHOOK_AUTH", "RevenueCat webhook authorization is invalid.");
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    await requireRevenueCatAuthorization(req);
    const payload = await parseJson(req, RevenueCatWebhookSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "revenuecat-webhook", clientIp(req), 1_200, 60);
    const result = await withSentrySpan("revenuecat.webhook.apply", "revenuecat.webhook", async () => await applyRevenueCatEvent(service, payload.event));
    return json({ received: true, duplicate: result.duplicate, ignored: result.ignored, event_id: payload.event.id }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

Deno.serve(withSentryHandler("revenuecat-webhook", handler));
