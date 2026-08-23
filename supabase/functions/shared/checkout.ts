/**
 * supabase/functions/shared/checkout.ts
 * ---------------------------------------------------------------------------
 * Selling a subscription outside the app stores.
 *
 * Google Play stopped requiring Play Billing after the March 2026 Epic
 * settlement, so a user can be sent to a web checkout — which is the only way
 * this product can take money at all: Play Billing needs a merchant account,
 * and crypto is the point of the exercise for users whose cards do not work.
 *
 * Everything here is pure. It is the part where being wrong means giving away a
 * paid plan, so it is decided by functions that can be tested rather than by
 * whatever a payment provider happened to POST:
 *
 *   - what a plan costs, server-side, so the client cannot name its own price
 *   - whether a payment actually covers it
 *   - whether an event has already been applied
 * ---------------------------------------------------------------------------
 */

/** What a plan costs, in USD cents. The server's number, never the client's. */
export const PLAN_PRICES: Record<string, { cents: number; months: number; tier: "pro" }> = {
  pro_monthly: { cents: 1200, months: 1, tier: "pro" },
  pro_yearly: { cents: 9600, months: 12, tier: "pro" },
};

export type PlanId = keyof typeof PLAN_PRICES;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && Object.hasOwn(PLAN_PRICES, value);
}

/**
 * How far under the asking price a payment may land and still count.
 *
 * Crypto settles in a coin whose price moves between the moment an invoice is
 * quoted and the moment it confirms, and networks take a fee out of the middle.
 * A payment that is a few cents light is a real payment, not an attack. Two
 * percent is wide enough for that and far too narrow to matter to someone
 * trying to buy a $96 plan for $1.
 */
export const UNDERPAYMENT_TOLERANCE = 0.02;

export interface PaymentFacts {
  planId: string;
  /** What the provider says actually settled, in USD cents. */
  paidCents: number;
  /** The provider's own status string, already normalised by its adapter. */
  status: "paid" | "pending" | "failed" | "expired";
}

export type PaymentVerdict =
  | { ok: true; tier: "pro"; months: number }
  | { ok: false; reason: string };

/**
 * Decide whether a settled payment earns the plan.
 *
 * The hole this closes is the oldest one in web payments: the provider reports
 * an amount, and if nobody checks it against the price, a user who edits the
 * invoice to $1 gets the $96 plan. So the price is looked up here, from the
 * server's own table, and compared.
 */
export function verifyPayment(facts: PaymentFacts): PaymentVerdict {
  if (facts.status !== "paid") {
    return { ok: false, reason: `Payment is ${facts.status}, not paid.` };
  }
  if (!isPlanId(facts.planId)) {
    return { ok: false, reason: `Unknown plan "${facts.planId}".` };
  }
  const plan = PLAN_PRICES[facts.planId];
  const required = Math.floor(plan.cents * (1 - UNDERPAYMENT_TOLERANCE));
  if (!Number.isFinite(facts.paidCents) || facts.paidCents < required) {
    return {
      ok: false,
      reason: `Paid ${facts.paidCents} cents, which is under the ${required} needed for ${facts.planId}.`,
    };
  }
  return { ok: true, tier: plan.tier, months: plan.months };
}

/**
 * When a plan bought now should run out.
 *
 * Extends from whatever is left of an existing period rather than from today,
 * so renewing early does not silently delete the time already paid for.
 */
export function periodEndAfter(
  months: number,
  now: Date,
  existingEnd?: string | null,
): string {
  const current = existingEnd ? new Date(existingEnd) : null;
  const base = current && !Number.isNaN(current.getTime()) && current > now ? current : now;
  const end = new Date(base.getTime());
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString();
}

/**
 * A checkout session's own id, carried to the provider and back.
 *
 * Its job is to name the buyer without putting a user id in a URL that travels
 * through a third party and a browser address bar. Unguessable, so a stranger
 * cannot claim someone else's paid invoice by quoting its reference.
 */
const REFERENCE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const REFERENCE_LENGTH = 22;

export function generateReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
    out += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return out;
}

export function isReference(value: unknown): value is string {
  return typeof value === "string" &&
    value.length === REFERENCE_LENGTH &&
    [...value].every((character) => REFERENCE_ALPHABET.includes(character));
}

/**
 * Whether this provider event has already been applied.
 *
 * Providers retry until they get a 2xx, and a retry that extends the
 * subscription a second time is a month given away. The session row records the
 * event it last acted on; the same id arriving again is a no-op, not an error —
 * returning a failure would only make the provider retry harder.
 */
export function isDuplicateEvent(
  seenEventId: string | null | undefined,
  incomingEventId: string,
): boolean {
  return !!seenEventId && seenEventId === incomingEventId;
}
