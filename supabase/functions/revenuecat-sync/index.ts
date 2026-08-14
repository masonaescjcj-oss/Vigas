import { withSentryHandler, withSentrySpan } from "../../../src/infra/monitoring/sentryConfig.ts";
import { EmptyInputSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { syncRevenueCatCustomer } from "../shared/revenuecat.ts";

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    await parseJson(req, EmptyInputSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "revenuecat-sync", user.id, 10, 60);
    const subscription = await withSentrySpan("revenuecat.customer.sync", "revenuecat.api", async () => await syncRevenueCatCustomer(service, user.id));
    return json({ synced: true, subscription }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

Deno.serve(withSentryHandler("revenuecat-sync", handler));
