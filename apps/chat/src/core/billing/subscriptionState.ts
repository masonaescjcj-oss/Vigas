/**
 * frontend/src/core/billing/subscriptionState.ts
 * ---------------------------------------------------------------------------
 * What to say about someone's plan, and what the button should do.
 *
 * The app used to print the raw tier — "FREE" — which tells a user their
 * status and nothing about what to do with it, and says the same thing to
 * someone who never subscribed as to someone whose subscription lapsed
 * yesterday. Those two people need different sentences and the same button.
 *
 * Pure, so both the chat header and the profile screen render the same words
 * from the same rules rather than each inventing their own.
 * ---------------------------------------------------------------------------
 */

export type Tier = "free" | "pro" | "ultra" | "team";
export type SubStatus = "active" | "canceled" | "expired" | "grace_period";

export interface SubscriptionFacts {
  tier?: Tier | string | null;
  status?: SubStatus | string | null;
  /** ISO timestamp. */
  currentPeriodEnd?: string | null;
}

export interface SubscriptionDisplay {
  /** The short word on the pill: "FREE", "PRO", "ENDED". */
  badge: string;
  /** One line under it, or null when the badge says enough. */
  detail: string | null;
  /** The button's words. Null when there is nothing to sell. */
  action: string | null;
  /** True when the state is something the user should fix. */
  needsAttention: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Turn billing state into the words on screen.
 *
 * @param now Injected so the "expires soon" boundary is testable rather than
 *   depending on when the suite happens to run.
 */
export function describeSubscription(
  facts: SubscriptionFacts,
  now: Date = new Date(),
): SubscriptionDisplay {
  const tier = String(facts.tier ?? "free").toLowerCase();
  const status = String(facts.status ?? "").toLowerCase();
  const remaining = daysUntil(facts.currentPeriodEnd, now);

  // Team is arranged with a human, so there is nothing to buy and no upgrade
  // to push. Offering one would be noise at best and wrong at worst.
  if (tier === "team") {
    return { badge: "TEAM", detail: null, action: null, needsAttention: false };
  }

  const paidTier = tier === "pro" || tier === "ultra";

  // A paid tier whose period has run out is the case the old UI got wrong: the
  // profile row still said "pro" while the subscription had lapsed, so it read
  // as active. The date decides, not the tier.
  const lapsed = paidTier && remaining !== null && remaining <= 0;

  if (status === "grace_period") {
    return {
      badge: "PAYMENT DUE",
      detail: "We could not take the last payment. Update it to keep Pro.",
      action: "Update subscription",
      needsAttention: true,
    };
  }

  if (lapsed || status === "expired" || (paidTier && status === "canceled" && remaining !== null && remaining <= 0)) {
    return {
      badge: "ENDED",
      detail: "Your subscription has ended.",
      action: "Update subscription",
      needsAttention: true,
    };
  }

  if (paidTier) {
    // Cancelled but still inside the paid period: they keep it until it runs
    // out, and saying so is more honest than showing a plain "PRO".
    if (status === "canceled") {
      return {
        badge: tier.toUpperCase(),
        detail: remaining !== null ? `Ends in ${remaining} day${remaining === 1 ? "" : "s"}.` : "Ending soon.",
        action: "Update subscription",
        needsAttention: true,
      };
    }
    if (remaining !== null && remaining <= 7) {
      return {
        badge: tier.toUpperCase(),
        detail: `Renews in ${remaining} day${remaining === 1 ? "" : "s"}.`,
        action: "Update subscription",
        needsAttention: false,
      };
    }
    return { badge: tier.toUpperCase(), detail: null, action: null, needsAttention: false };
  }

  return {
    badge: "FREE",
    detail: null,
    // Same words as the lapsed case on purpose: one button, one meaning —
    // "go and sort your plan out" — rather than a word that changes under a
    // user depending on a state they cannot see.
    action: "Update subscription",
    needsAttention: false,
  };
}
