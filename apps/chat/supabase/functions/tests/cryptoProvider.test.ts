/**
 * Believing a webhook.
 *
 * A signature check that is subtly wrong looks identical to one that works,
 * until someone posts their own payload and is handed a subscription. So the
 * forgery cases are the point of this file, not the happy path.
 */
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  NowPaymentsProvider,
  sortKeysDeep,
  verifyHmacSignature,
} from "../shared/cryptoProvider.ts";

const SECRET = "ipn-secret-value";

/** What NOWPayments would send, signed the way NOWPayments signs it. */
async function signedBody(payload: Record<string, unknown>, secret = SECRET) {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  const signature = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Deliberately NOT the canonical form: a real provider posts its own key
  // order, and the adapter has to re-canonicalise before checking.
  return { raw: JSON.stringify(payload), signature };
}

const PAID = {
  payment_id: 5514234,
  payment_status: "finished",
  order_id: "abcdefghjkmnpqrstuvwx",
  order_description: "pro_yearly",
  price_amount: 96,
  price_currency: "usd",
  actually_paid: 0.0021,
  pay_currency: "btc",
};

Deno.test("a genuine webhook is accepted and read", async () => {
  const provider = new NowPaymentsProvider("api-key", SECRET);
  const { raw, signature } = await signedBody(PAID);
  const result = await provider.parseWebhook(raw, new Headers({ "x-nowpayments-sig": signature }));

  assertEquals(result.reference, "abcdefghjkmnpqrstuvwx");
  assertEquals(result.facts.planId, "pro_yearly");
  // Priced in USD, not in the coin: actually_paid is 0.0021 BTC and means
  // nothing to a plan price.
  assertEquals(result.facts.paidCents, 9600);
  assertEquals(result.facts.status, "paid");
});

Deno.test("the signature is over the provider's canonical form, not the bytes sent", async () => {
  // NOWPayments signs the key-sorted payload. Verifying the raw body would
  // reject every legitimate call — a bug that only shows up in production.
  const provider = new NowPaymentsProvider("api-key", SECRET);
  const shuffled = {
    pay_currency: "btc",
    order_id: PAID.order_id,
    payment_status: "finished",
    price_amount: 96,
    payment_id: PAID.payment_id,
    order_description: "pro_yearly",
    actually_paid: 0.0021,
    price_currency: "usd",
  };
  const { raw, signature } = await signedBody(shuffled);
  const result = await provider.parseWebhook(raw, new Headers({ "x-nowpayments-sig": signature }));
  assertEquals(result.facts.status, "paid");
});

Deno.test("a forged webhook is refused", async () => {
  const provider = new NowPaymentsProvider("api-key", SECRET);

  // Signed with the wrong secret — someone who found the endpoint.
  const wrongSecret = await signedBody(PAID, "not-the-secret");
  await assertRejects(
    () => provider.parseWebhook(wrongSecret.raw, new Headers({ "x-nowpayments-sig": wrongSecret.signature })),
  );

  // No signature at all.
  await assertRejects(() => provider.parseWebhook(JSON.stringify(PAID), new Headers()));

  // A valid signature over a *different* payload, replayed onto a bigger plan.
  const cheap = await signedBody({ ...PAID, order_description: "pro_monthly", price_amount: 12 });
  await assertRejects(
    () =>
      provider.parseWebhook(
        JSON.stringify({ ...PAID, order_description: "pro_yearly", price_amount: 96 }),
        new Headers({ "x-nowpayments-sig": cheap.signature }),
      ),
  );
});

Deno.test("tampering with any field invalidates the signature", async () => {
  const provider = new NowPaymentsProvider("api-key", SECRET);
  const { signature } = await signedBody(PAID);

  // Each of these is a way to turn someone else's small payment into your
  // large subscription.
  const tampered = [
    { ...PAID, price_amount: 9600 },
    { ...PAID, order_id: "zzzzzzzzzzzzzzzzzzzzzz" },
    { ...PAID, order_description: "pro_yearly", price_amount: 1 },
    { ...PAID, payment_status: "finished", price_amount: 0 },
  ];
  for (const payload of tampered) {
    await assertRejects(
      () => provider.parseWebhook(JSON.stringify(payload), new Headers({ "x-nowpayments-sig": signature })),
      Error,
      undefined,
      `tampered payload was accepted: ${JSON.stringify(payload)}`,
    );
  }
});

Deno.test("provider statuses map to the four the rest of the code knows", async () => {
  const provider = new NowPaymentsProvider("api-key", SECRET);
  const cases: Array<[string, string]> = [
    ["finished", "paid"],
    ["confirmed", "paid"],
    ["waiting", "pending"],
    ["confirming", "pending"],
    ["sending", "pending"],
    // Partially paid is pending, not paid: the amount check would catch it
    // anyway, but calling it "paid" here would rely on that as the only guard.
    ["partially_paid", "pending"],
    ["expired", "expired"],
    ["failed", "failed"],
    ["refunded", "failed"],
    ["something-new-they-added", "failed"],
  ];
  for (const [provided, expected] of cases) {
    const { raw, signature } = await signedBody({ ...PAID, payment_status: provided });
    const result = await provider.parseWebhook(raw, new Headers({ "x-nowpayments-sig": signature }));
    assertEquals(result.facts.status, expected, `${provided} should map to ${expected}`);
  }
});

Deno.test("the event id distinguishes one payment's stages", async () => {
  // The same payment reports several times as it confirms. Only the transition
  // into a paid state should ever be applied, and only once.
  const provider = new NowPaymentsProvider("api-key", SECRET);
  const confirming = await signedBody({ ...PAID, payment_status: "confirming" });
  const finished = await signedBody({ ...PAID, payment_status: "finished" });

  const a = await provider.parseWebhook(confirming.raw, new Headers({ "x-nowpayments-sig": confirming.signature }));
  const b = await provider.parseWebhook(finished.raw, new Headers({ "x-nowpayments-sig": finished.signature }));
  assertEquals(a.eventId === b.eventId, false);
  assertEquals(b.eventId, "5514234:finished");
});

Deno.test("hmac comparison rejects a truncated or overlong signature", async () => {
  const body = "{}";
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const good = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  assertEquals(await verifyHmacSignature(body, good, SECRET), true);
  assertEquals(await verifyHmacSignature(body, good.toUpperCase(), SECRET), true);
  // A prefix must not pass by comparing only as far as the shorter string.
  assertEquals(await verifyHmacSignature(body, good.slice(0, 32), SECRET), false);
  assertEquals(await verifyHmacSignature(body, good + "00", SECRET), false);
  assertEquals(await verifyHmacSignature(body, "", SECRET), false);
  // No secret configured must fail closed, not accept everything.
  assertEquals(await verifyHmacSignature(body, good, ""), false);
});

Deno.test("sortKeysDeep reaches nested objects and arrays", () => {
  assertEquals(
    JSON.stringify(sortKeysDeep({ b: 1, a: { d: 2, c: [{ f: 3, e: 4 }] } })),
    '{"a":{"c":[{"e":4,"f":3}],"d":2},"b":1}',
  );
});
