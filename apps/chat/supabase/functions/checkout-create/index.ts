/**
 * supabase/functions/checkout-create/index.ts
 * ---------------------------------------------------------------------------
 * Handing a signed-in user to a browser to pay, without handing over a session.
 *
 * The obvious version of this puts the user's token in the checkout URL so the
 * website "knows who they are". That is a long-lived credential in a browser
 * address bar: it lands in history, in the referrer of every link on the page,
 * and in the logs of everything between here and there.
 *
 * Instead the app asks *this* endpoint — where it is already authenticated —
 * and gets back a URL carrying a reference that means nothing on its own. The
 * reference names a row, the row names the buyer, and the row lives here. If
 * the URL leaks, the worst a stranger can do is pay for someone else's
 * subscription.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { CheckoutCreateSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { checkoutPriceCents, generateReference, isCreditPack, isPlanId } from "../shared/checkout.ts";
import { AvexPayProvider, NowPaymentsProvider } from "../shared/cryptoProvider.ts";

/** Where the user lands after paying, or after giving up. */
function returnUrls(itemId: string, reference: string): { successUrl: string; cancelUrl: string } {
  const base = (Deno.env.get("CHECKOUT_RETURN_URL") ?? "https://vigas.app").replace(/\/+$/, "");
  const kind = isCreditPack(itemId) ? "credits" : "plan";
  const ref = encodeURIComponent(reference);
  return {
    successUrl: `${base}/dashboard?checkout=success&item=${kind}&ref=${ref}`,
    cancelUrl: `${base}/dashboard?checkout=cancelled&item=${kind}&ref=${ref}`,
  };
}

function provider() {
  const preferred = (Deno.env.get("PAYMENT_PROVIDER") ?? "").toLowerCase();
  const avexKey = Deno.env.get("AVEXPAY_API_KEY");
  const avexSecret = Deno.env.get("AVEXPAY_WEBHOOK_SECRET") ?? "";
  const avexOrg = Deno.env.get("AVEXPAY_ORG_ID") ?? "";
  const avexBase = (Deno.env.get("AVEXPAY_BASE_URL") ?? "https://api.avexpay.net/v1").replace(/\/+$/, "");

  if (preferred === "avexpay" || (avexKey && preferred !== "nowpayments")) {
    if (!avexKey) {
      throw new AppError(503, "CHECKOUT_NOT_CONFIGURED", "AvexPay is not configured yet.");
    }
    return new AvexPayProvider(avexKey, avexSecret, avexOrg, avexBase);
  }

  const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
  const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
  if (!apiKey || !ipnSecret) {
    // Named precisely, because the alternative is an operator reading
    // "checkout failed" and going looking in the payment provider's dashboard
    // for a problem that is a missing secret here.
    throw new AppError(
      503,
      "CHECKOUT_NOT_CONFIGURED",
      "Payments are not switched on yet. Nothing was charged.",
    );
  }
  return new NowPaymentsProvider(apiKey, ipnSecret);
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, CheckoutCreateSchema);
    const service = createServiceClient();

    // Each attempt raises an invoice with the provider, so this is limited
    // harder than a read would be.
    await enforceRateLimit(service, "checkout-create", user.id, 6, 300);

    const priceCents = checkoutPriceCents(input.planId);
    if (priceCents === null || (!isPlanId(input.planId) && !isCreditPack(input.planId))) {
      throw new AppError(400, "UNKNOWN_PLAN", "That plan or credit pack does not exist.");
    }
    const plan = { cents: priceCents };
    const pay = provider();

    // The row is written before the provider is called, so a reference can
    // never come back on a webhook without a row behind it. A provider that
    // then fails leaves a pending row, which expires on its own.
    const reference = generateReference();
    const { error: insertError } = await service.from("checkout_sessions").insert({
      reference,
      user_id: user.id,
      plan_id: input.planId,
      // The price as of now. Recorded so a later price change cannot make an
      // in-flight payment retroactively insufficient.
      amount_cents: plan.cents,
      provider: pay.name,
    });
    if (insertError) {
      if (insertError.code === "PGRST205" || insertError.code === "42P01") {
        throw new AppError(
          503,
          "CHECKOUT_NOT_MIGRATED",
          "Checkout needs a database migration that has not been applied yet (checkout_sessions).",
        );
      }
      throw insertError;
    }

    const { successUrl, cancelUrl } = returnUrls(input.planId, reference);
    let invoice;
    try {
      invoice = await pay.createInvoice({
        reference,
        amountCents: plan.cents,
        planId: input.planId,
        successUrl,
        cancelUrl,
      });
    } catch (error) {
      // Take the row back rather than leaving a reference that can never be
      // paid — a webhook quoting it would otherwise look like a real payment
      // for an invoice that was never raised.
      await service.from("checkout_sessions").delete().eq("reference", reference);
      throw new AppError(
        502,
        "CHECKOUT_PROVIDER_FAILED",
        `Could not start the payment: ${(error as Error).message}`,
      );
    }

    await service.from("checkout_sessions")
      .update({ provider_invoice_id: invoice.invoiceId, updated_at: new Date().toISOString() })
      .eq("reference", reference);

    return json({
      url: invoice.url,
      reference,
      // Echoed so the app can show what is being bought without a second
      // source of truth for the price.
      planId: input.planId,
      amountCents: plan.cents,
    }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("checkout-create", handler));
}
