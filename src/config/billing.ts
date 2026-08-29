/**
 * config/billing.ts
 * ---------------------------------------------------------------------------
 * Whether this build sells anything.
 *
 * The app is launching free. Not because the paid tiers do not work — the
 * checkout, the plans, the tier gating and the crypto webhook are all built and
 * tested — but because shipping a payment flow is the part of a store review
 * most likely to come back rejected, and a rejection costs weeks. Free first,
 * plans once it is in.
 *
 * So this is a switch, not a deletion. Everything behind it stays compiled,
 * stays tested, and turns back on by flipping one constant. Deleting it would
 * mean building it twice.
 *
 * What it hides is the *selling*: paywalls, upgrade prompts, plan badges, and
 * anything that tells someone a better version exists behind money. What it
 * deliberately does not touch is the daily build allowance — that protects the
 * model bill and has nothing to do with whether there is a shop.
 * ---------------------------------------------------------------------------
 */

/**
 * True once there is something to buy.
 *
 * Read at build time rather than from a server flag: a store reviewer must not
 * be able to see a purchase surface appear after approval, and neither should
 * anyone else.
 */
export const BILLING_ENABLED = false;

/**
 * What to call the current tier when nothing is for sale.
 *
 * "FREE" is only meaningful against a paid alternative. With no alternative it
 * is noise on every screen it appears on, so those places show nothing instead.
 */
export const TIER_BADGE_VISIBLE = BILLING_ENABLED;
