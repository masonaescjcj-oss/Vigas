/**
 * The rules that decide whether someone gets a paid plan.
 *
 * Every case here is a way to get Pro without paying for it, so they are
 * written as attacks rather than as happy paths.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  generateReference,
  isDuplicateEvent,
  isPlanId,
  isReference,
  periodEndAfter,
  PLAN_PRICES,
  REFERENCE_LENGTH,
  verifyPayment,
} from "../shared/checkout.ts";

Deno.test("a full payment earns the plan", () => {
  assertEquals(verifyPayment({ planId: "pro_monthly", paidCents: 1200, status: "paid" }), {
    ok: true,
    tier: "pro",
    months: 1,
  });
  assertEquals(verifyPayment({ planId: "pro_yearly", paidCents: 9600, status: "paid" }), {
    ok: true,
    tier: "pro",
    months: 12,
  });
});

Deno.test("paying a dollar for a ninety-six dollar plan does not earn it", () => {
  // The oldest hole in web payments: trust the provider's amount without
  // checking it against a price the server owns.
  const verdict = verifyPayment({ planId: "pro_yearly", paidCents: 100, status: "paid" });
  assertEquals(verdict.ok, false);
});

Deno.test("a payment a few cents light still counts", () => {
  // Crypto settles in a coin whose price moves between quote and confirmation,
  // and the network takes a fee out of the middle. Refusing these would refuse
  // real payments.
  const nearly = Math.floor(PLAN_PRICES.pro_yearly.cents * 0.99);
  assertEquals(verifyPayment({ planId: "pro_yearly", paidCents: nearly, status: "paid" }).ok, true);

  // But the tolerance is narrow enough to be useless as an attack.
  const tooLight = Math.floor(PLAN_PRICES.pro_yearly.cents * 0.90);
  assertEquals(verifyPayment({ planId: "pro_yearly", paidCents: tooLight, status: "paid" }).ok, false);
});

Deno.test("only a settled payment counts", () => {
  for (const status of ["pending", "failed", "expired"] as const) {
    assertEquals(
      verifyPayment({ planId: "pro_monthly", paidCents: 1200, status }).ok,
      false,
      `${status} must not grant the plan`,
    );
  }
});

Deno.test("an unknown or invented plan id earns nothing", () => {
  // The plan travels through the provider and back, so it is attacker-editable.
  assertEquals(verifyPayment({ planId: "pro_free", paidCents: 999999, status: "paid" }).ok, false);
  assertEquals(verifyPayment({ planId: "__proto__", paidCents: 999999, status: "paid" }).ok, false);
  assertEquals(verifyPayment({ planId: "", paidCents: 999999, status: "paid" }).ok, false);
  assertEquals(isPlanId("constructor"), false);
  assertEquals(isPlanId("pro_monthly"), true);
});

Deno.test("a nonsense amount is refused rather than coerced", () => {
  for (const paidCents of [NaN, Infinity, -Infinity, -9600]) {
    assertEquals(
      verifyPayment({ planId: "pro_yearly", paidCents, status: "paid" }).ok,
      false,
      `${paidCents} must not grant the plan`,
    );
  }
});

Deno.test("renewing early keeps the time already paid for", () => {
  const now = new Date("2026-03-01T00:00:00.000Z");
  // Two months still on the clock: a new year must land 12 months after that,
  // not 12 months from today, or renewing early quietly deletes two months.
  const existing = "2026-05-01T00:00:00.000Z";
  assertEquals(periodEndAfter(12, now, existing), "2027-05-01T00:00:00.000Z");
});

Deno.test("an expired or missing period starts from now", () => {
  const now = new Date("2026-03-01T00:00:00.000Z");
  assertEquals(periodEndAfter(1, now, null), "2026-04-01T00:00:00.000Z");
  assertEquals(periodEndAfter(1, now, "2025-01-01T00:00:00.000Z"), "2026-04-01T00:00:00.000Z");
  // A corrupt timestamp must not produce an Invalid Date that reads as forever.
  assertEquals(periodEndAfter(1, now, "not a date"), "2026-04-01T00:00:00.000Z");
});

Deno.test("a replayed provider event does not extend the plan twice", () => {
  // Providers retry until they get a 2xx. A retry that grants another month is
  // a month given away.
  assertEquals(isDuplicateEvent("evt_1", "evt_1"), true);
  assertEquals(isDuplicateEvent("evt_1", "evt_2"), false);
  assertEquals(isDuplicateEvent(null, "evt_1"), false);
  assertEquals(isDuplicateEvent(undefined, "evt_1"), false);
  // An empty stored id is "nothing applied yet", not a match for an empty one.
  assertEquals(isDuplicateEvent("", ""), false);
});

Deno.test("a reference is unguessable and readable", () => {
  const reference = generateReference();
  assertEquals(reference.length, REFERENCE_LENGTH);
  assertEquals(isReference(reference), true);
  // Ambiguous glyphs are out: these end up in URLs people paste and read out.
  for (const ambiguous of ["0", "o", "1", "l", "i"]) {
    assertEquals(reference.includes(ambiguous), false, `contains ${ambiguous}`);
  }
  // 22 characters of this alphabet is ~109 bits — not enumerable.
  const many = new Set(Array.from({ length: 500 }, () => generateReference()));
  assertEquals(many.size, 500);
});

Deno.test("a reference from a stranger is validated before it is used", () => {
  // It arrives in a webhook body and becomes a database lookup key.
  assertEquals(isReference("../../etc/passwd"), false);
  assertEquals(isReference("' or 1=1 --"), false);
  assertEquals(isReference("short"), false);
  assertEquals(isReference(null), false);
  assertEquals(isReference("A".repeat(REFERENCE_LENGTH)), false); // uppercase is not in the alphabet
});
