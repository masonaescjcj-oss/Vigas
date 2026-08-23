/**
 * The words shown about someone's plan.
 *
 * The case worth guarding is the lapsed one: the profile row keeps saying
 * "pro" after the paid period ends, so anything that trusts the tier alone
 * shows an expired account a plain "PRO" badge and never offers a renewal.
 */

import { describe, expect, it } from "vitest";
import { describeSubscription } from "../subscriptionState";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("a free account", () => {
  it("is offered the same button as a lapsed one", () => {
    const free = describeSubscription({ tier: "free" }, NOW);
    expect(free.badge).toBe("FREE");
    // One button with one meaning. A word that changes under the user
    // depending on state they cannot see is worse than a constant one.
    expect(free.action).toBe("Update subscription");
    expect(free.needsAttention).toBe(false);
  });

  it("treats a missing tier as free rather than throwing", () => {
    expect(describeSubscription({}, NOW).badge).toBe("FREE");
    expect(describeSubscription({ tier: null }, NOW).badge).toBe("FREE");
  });
});

describe("a paid account", () => {
  it("says nothing extra when it is healthy and far from renewal", () => {
    const pro = describeSubscription(
      { tier: "pro", status: "active", currentPeriodEnd: inDays(200) },
      NOW,
    );
    expect(pro.badge).toBe("PRO");
    expect(pro.detail).toBeNull();
    // Nothing to fix, so nothing to press.
    expect(pro.action).toBeNull();
  });

  it("mentions renewal only when it is close", () => {
    expect(describeSubscription({ tier: "pro", status: "active", currentPeriodEnd: inDays(30) }, NOW).detail)
      .toBeNull();
    expect(describeSubscription({ tier: "pro", status: "active", currentPeriodEnd: inDays(3) }, NOW).detail)
      .toBe("Renews in 3 days.");
    // Singular, because "1 days" is the kind of thing a user notices.
    expect(describeSubscription({ tier: "pro", status: "active", currentPeriodEnd: inDays(1) }, NOW).detail)
      .toBe("Renews in 1 day.");
  });
});

describe("the states the old UI got wrong", () => {
  it("shows a lapsed subscription as ended, not as PRO", () => {
    // The profile row still says "pro" — the date is what decides.
    const lapsed = describeSubscription(
      { tier: "pro", status: "active", currentPeriodEnd: inDays(-1) },
      NOW,
    );
    expect(lapsed.badge).toBe("ENDED");
    expect(lapsed.detail).toBe("Your subscription has ended.");
    expect(lapsed.action).toBe("Update subscription");
    expect(lapsed.needsAttention).toBe(true);
  });

  it("keeps a cancelled subscription until it actually runs out", () => {
    // Cancelled is not ended. Taking it away early would be taking away
    // something already paid for.
    const cancelled = describeSubscription(
      { tier: "pro", status: "canceled", currentPeriodEnd: inDays(10) },
      NOW,
    );
    expect(cancelled.badge).toBe("PRO");
    expect(cancelled.detail).toBe("Ends in 10 days.");
    expect(cancelled.needsAttention).toBe(true);

    const runOut = describeSubscription(
      { tier: "pro", status: "canceled", currentPeriodEnd: inDays(-2) },
      NOW,
    );
    expect(runOut.badge).toBe("ENDED");
  });

  it("names a failed payment as a payment problem", () => {
    const grace = describeSubscription(
      { tier: "pro", status: "grace_period", currentPeriodEnd: inDays(2) },
      NOW,
    );
    expect(grace.badge).toBe("PAYMENT DUE");
    expect(grace.needsAttention).toBe(true);
    expect(grace.action).toBe("Update subscription");
  });
});

describe("team", () => {
  it("is never sold anything", () => {
    // Arranged with a human. An upgrade button here is noise at best.
    const team = describeSubscription({ tier: "team", status: "active" }, NOW);
    expect(team.badge).toBe("TEAM");
    expect(team.action).toBeNull();
    expect(team.needsAttention).toBe(false);
  });

  it("stays team even with no period recorded", () => {
    expect(describeSubscription({ tier: "team" }, NOW).badge).toBe("TEAM");
  });
});

describe("bad data", () => {
  it("does not read a corrupt date as expired", () => {
    // An unparseable timestamp must not silently downgrade a paying customer.
    const odd = describeSubscription(
      { tier: "pro", status: "active", currentPeriodEnd: "not a date" },
      NOW,
    );
    expect(odd.badge).toBe("PRO");
    expect(odd.action).toBeNull();
  });

  it("handles an unknown tier as free rather than granting it", () => {
    const unknown = describeSubscription({ tier: "enterprise-typo", status: "active" }, NOW);
    expect(unknown.badge).toBe("FREE");
  });
});
