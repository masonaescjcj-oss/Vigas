/**
 * supabase/functions/shared/cryptoProvider.ts
 * ---------------------------------------------------------------------------
 * Talking to a crypto payment processor, and believing what it says back.
 *
 * Written against an interface rather than one vendor because the choice of
 * processor is a business decision that changes — and because the half that
 * matters for security, checking that a webhook really came from the
 * processor, is the same shape for all of them and should only be written once.
 *
 * The adapter's job is narrow: turn a vendor's payload into `PaymentFacts`, and
 * prove the payload is authentic. What that payment then earns is decided in
 * checkout.ts, which knows the prices and can be tested without a network.
 * ---------------------------------------------------------------------------
 */

import type { PaymentFacts } from "./checkout.ts";

export interface InvoiceRequest {
  reference: string;
  amountCents: number;
  planId: string;
  /** Where the provider sends the user once they are done. */
  successUrl: string;
  cancelUrl: string;
}

export interface Invoice {
  /** The provider's hosted payment page. This is what the user is sent to. */
  url: string;
  /** The provider's own id, so a webhook can be matched to a session. */
  invoiceId: string;
}

export interface WebhookResult {
  /** Our reference, echoed back by the provider. */
  reference: string;
  /** The provider's event id, for replay detection. */
  eventId: string;
  facts: PaymentFacts;
}

export interface CryptoProvider {
  readonly name: string;
  createInvoice(request: InvoiceRequest): Promise<Invoice>;
  /**
   * Verify and parse a webhook.
   *
   * Takes the raw body text, not a parsed object: a signature covers exact
   * bytes, and `JSON.parse` then `JSON.stringify` does not reproduce them.
   * Throws if the signature does not check out — a caller must not be able to
   * accidentally use an unverified payload.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}

/**
 * HMAC-SHA512 over the raw body, compared in constant time.
 *
 * Exported because it is the piece worth testing on its own: a signature check
 * that is subtly wrong is indistinguishable from one that works, right up until
 * someone posts their own payload and is granted a subscription.
 */
export async function verifyHmacSignature(
  rawBody: string,
  signature: string,
  secret: string,
  hash: "SHA-512" | "SHA-256" = "SHA-512",
): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Length is compared first and separately: it is not secret, and letting the
  // loop below run over mismatched lengths would either throw or read past the
  // shorter string.
  const actual = signature.trim().toLowerCase();
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * NOWPayments.
 *
 * Chosen as the first adapter because it settles in many coins and does not
 * require the merchant to hold any of them. Its webhook signs the JSON body
 * with HMAC-SHA512 over the *key-sorted* payload, which is unusual and easy to
 * get wrong — the signature is not over the bytes as sent.
 */
export class NowPaymentsProvider implements CryptoProvider {
  readonly name = "nowpayments";

  constructor(
    private readonly apiKey: string,
    private readonly ipnSecret: string,
    private readonly baseUrl = "https://api.nowpayments.io/v1",
  ) {}

  async createInvoice(request: InvoiceRequest): Promise<Invoice> {
    const response = await fetch(`${this.baseUrl}/invoice`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: request.amountCents / 100,
        price_currency: "usd",
        // Our reference travels here and comes back on the webhook. It is the
        // only link between a payment and an account.
        order_id: request.reference,
        order_description: request.planId,
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      }),
    });
    if (!response.ok) {
      throw new Error(`NOWPayments refused the invoice (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }
    const body = await response.json();
    if (!body?.invoice_url || !body?.id) {
      throw new Error("NOWPayments returned no invoice URL.");
    }
    return { url: String(body.invoice_url), invoiceId: String(body.id) };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const signature = headers.get("x-nowpayments-sig") ?? "";
    // NOWPayments signs the payload with its keys sorted, not the bytes it
    // sent. Verifying the raw body instead fails every legitimate call.
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const canonical = JSON.stringify(sortKeysDeep(parsed));
    if (!(await verifyHmacSignature(canonical, signature, this.ipnSecret))) {
      throw new Error("Signature does not match.");
    }

    const status = String(parsed.payment_status ?? "");
    return {
      reference: String(parsed.order_id ?? ""),
      // No dedicated event id, so the payment id plus the status it reported
      // is the unit that must not be applied twice.
      eventId: `${parsed.payment_id ?? ""}:${status}`,
      facts: {
        planId: String(parsed.order_description ?? ""),
        // actually_paid is in the *crypto* currency; price_amount is the USD
        // the invoice was raised for and is what a plan is priced in.
        paidCents: Math.round(Number(parsed.price_amount ?? 0) * 100),
        status: normaliseStatus(status),
      },
    };
  }
}

/** NOWPayments' statuses, reduced to the four the rest of the code knows. */
function normaliseStatus(status: string): PaymentFacts["status"] {
  switch (status) {
    case "finished":
    case "confirmed":
      return "paid";
    case "partially_paid":
    case "waiting":
    case "confirming":
    case "sending":
      return "pending";
    case "expired":
      return "expired";
    default:
      return "failed";
  }
}

/** Recursively key-sorted copy, for providers that sign a canonical form. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
