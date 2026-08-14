import { evaluateUsage } from "../shared/usage.ts";
import { deriveRevenueCatState } from "../shared/revenuecat.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("agent-run usage guard rejects a free user at the token ceiling", () => {
  const now = new Date("2026-07-20T00:00:00.000Z");
  const decision = evaluateUsage("free", {
    tokens_used: 100_000,
    requests_count: 12,
    plan_limit_tokens: 100_000,
    period_start: "2026-07-20T00:00:00.000Z",
    period_end: "2026-07-21T00:00:00.000Z",
  }, now);
  assert(!decision.allowed, "The full free-tier meter must be rejected.");
});

Deno.test("revenuecat cancellation keeps Pro until the paid period expires", () => {
  const now = new Date("2026-07-20T00:00:00.000Z");
  const state = deriveRevenueCatState({
    type: "CANCELLATION",
    product_id: "issac_pro_monthly",
    expiration_at_ms: Date.parse("2026-08-20T00:00:00.000Z"),
    event_timestamp_ms: Date.parse("2026-07-20T00:00:00.000Z"),
  }, null, now);
  assert(state.status === "canceled", "Cancellation must be recorded as canceled.");
  assert(state.tier === "pro", "Cancellation must not revoke access before expiration.");
  assert(state.currentPeriodEnd === "2026-08-20T00:00:00.000Z", "The paid period end must be retained.");
});

Deno.test("RevenueCat billing issue grants exactly a three-day grace period", () => {
  const now = new Date("2026-07-20T00:00:00.000Z");
  const state = deriveRevenueCatState({
    type: "BILLING_ISSUE",
    product_id: "issac_pro_monthly",
    expiration_at_ms: Date.parse("2026-07-20T00:00:00.000Z"),
    event_timestamp_ms: Date.parse("2026-07-20T00:00:00.000Z"),
  }, null, now);
  assert(state.status === "grace_period" && state.tier === "pro", "Billing issue must preserve Pro access.");
  assert(state.graceExpiresAt === "2026-07-23T00:00:00.000Z", "Grace period must be three days.");
});
