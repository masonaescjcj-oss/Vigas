/**
 * supabase/functions/crypto-webhook/index.ts
 * ---------------------------------------------------------------------------
 * The payment provider telling us a payment landed.
 *
 * Public by necessity — the provider is not an Auth user — so every byte of it
 * is hostile until the signature checks out. Deployed with --no-verify-jwt for
 * the same reason, which means this file is the only thing standing between a
 * stranger's POST and a free subscription.
 *
 * The order matters and is deliberate:
 *   1. verify the signature over the provider's canonical form
 *   2. find the session by *our* reference, not by anything in the payload
 *   3. refuse a replay of an event already applied
 *   4. check the amount against the price the server recorded
 *   5. only then grant anything
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { AppError, assertMethod, errorResponse } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient } from "../shared/supabase.ts";
import { isDuplicateEvent, isReference, periodEndAfter, verifyPayment } from "../shared/checkout.ts";
import { NowPaymentsProvider } from "../shared/cryptoProvider.ts";

/** A body larger than this is not a payment notification. */
const MAX_BODY_BYTES = 64_000;

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);

    const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY") ?? "";
    const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
    if (!ipnSecret) {
      // Fail closed. With no secret every signature check would have to either
      // pass or fail; passing would be catastrophic, so say what is wrong.
      throw new AppError(500, "SERVER_MISCONFIGURED", "NOWPAYMENTS_IPN_SECRET is not configured.");
    }

    // Read as text, not JSON: the signature covers exact bytes, and parsing
    // then re-serialising does not reproduce them.
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "That is too large to be a payment notification.");
    }

    const provider = new NowPaymentsProvider(apiKey, ipnSecret);
    let parsed;
    try {
      parsed = await provider.parseWebhook(rawBody, req.headers);
    } catch (error) {
      // One message for a bad signature and for unparseable JSON: a caller
      // probing this endpoint learns nothing about which it got wrong.
      console.error(`[crypto-webhook] rejected: ${(error as Error).message}`);
      throw new AppError(401, "INVALID_WEBHOOK_SIGNATURE", "Signature verification failed.");
    }

    if (!isReference(parsed.reference)) {
      throw new AppError(400, "INVALID_REFERENCE", "That is not a checkout reference.");
    }

    const service = createServiceClient();
    const { data: session, error: lookupError } = await service
      .from("checkout_sessions")
      .select("reference,user_id,plan_id,amount_cents,status,last_event_id")
      .eq("reference", parsed.reference)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!session) {
      // A signed payload naming a reference we never issued. Worth shouting
      // about: either the secret leaked or two projects share one account.
      console.error(`[crypto-webhook] signed event for unknown reference ${parsed.reference}`);
      throw new AppError(404, "UNKNOWN_CHECKOUT", "No such checkout.");
    }

    // Providers retry until they get a 2xx. Answer 200, change nothing.
    if (isDuplicateEvent(session.last_event_id, parsed.eventId)) {
      return json({ ok: true, duplicate: true }, 200, headers);
    }

    // The plan comes from our row, not from the payload: the payload's copy
    // travelled through the provider and a browser and is attacker-editable.
    const verdict = verifyPayment({
      planId: String(session.plan_id),
      paidCents: parsed.facts.paidCents,
      status: parsed.facts.status,
    });

    if (!verdict.ok) {
      // Recorded, not granted. A pending confirmation is normal and will be
      // followed by another event; a genuine shortfall needs to be visible.
      await service.from("checkout_sessions").update({
        status: parsed.facts.status === "paid" ? "failed" : parsed.facts.status,
        last_event_id: parsed.eventId,
        paid_cents: parsed.facts.paidCents,
        updated_at: new Date().toISOString(),
      }).eq("reference", session.reference);
      console.warn(`[crypto-webhook] not granted for ${session.reference}: ${verdict.reason}`);
      return json({ ok: true, granted: false }, 200, headers);
    }

    // ── Grant it.
    const userId = String(session.user_id);
    const { data: existing } = await service
      .from("subscriptions").select("current_period_end").eq("user_id", userId).maybeSingle();

    const periodEnd = periodEndAfter(verdict.months, new Date(), existing?.current_period_end);

    const { error: subError } = await service.from("subscriptions").upsert({
      user_id: userId,
      plan_id: String(session.plan_id),
      status: "active",
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (subError) throw subError;

    // Team is set by an operator and outranks anything bought here, so buying
    // Pro must not quietly demote a team account.
    const { data: profile } = await service
      .from("profiles").select("subscription_tier").eq("id", userId).maybeSingle();
    const tier = profile?.subscription_tier === "team" ? "team" : verdict.tier;
    const { error: profileError } = await service
      .from("profiles").update({ subscription_tier: tier }).eq("id", userId);
    if (profileError) throw profileError;

    // Marked last: if anything above failed, the session stays un-applied and
    // the provider's next retry tries again rather than finding it "done".
    await service.from("checkout_sessions").update({
      status: "paid",
      last_event_id: parsed.eventId,
      paid_cents: parsed.facts.paidCents,
      updated_at: new Date().toISOString(),
    }).eq("reference", session.reference);

    console.log(`[crypto-webhook] granted ${session.plan_id} to ${userId} until ${periodEnd}`);
    return json({ ok: true, granted: true }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("crypto-webhook", handler));
}
