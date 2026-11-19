/**
 * frontend/src/core/billing/distribution.ts
 * ---------------------------------------------------------------------------
 * Whether this copy of the app may send someone out to buy something.
 *
 * The same codebase ships to places with different rules. On the web there are
 * none. In a direct APK or an alternative Android store there are none. From
 * Google Play there are: a tap that leads to an external purchase is a
 * "link-out", which starts a 24-hour attribution window, owes Play a service
 * fee, and has to be reported through their API from October 2026.
 *
 * What Play does *not* restrict, since the March 2026 settlement, is telling
 * users that other payment options exist. The line is the tap, not the
 * sentence. So a Play build says where plans are managed and stops there; every
 * other build gets the button.
 *
 * Pure, and it fails closed: an unconfigured native build is treated as if it
 * came from Play. Being wrong in that direction costs a tap; being wrong the
 * other way is a policy violation on someone else's app account.
 * ---------------------------------------------------------------------------
 */

/** Where this binary came from. Set at build time, not detected at runtime. */
export type Channel = "play" | "direct" | "web" | "ios-app-store" | "unknown";

export function normaliseChannel(value: unknown): Channel {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "play" || raw === "google-play") return "play";
  if (raw === "direct" || raw === "apk" || raw === "bazaar") return "direct";
  if (raw === "web") return "web";
  if (raw === "ios" || raw === "app-store" || raw === "ios-app-store") return "ios-app-store";
  return "unknown";
}

export interface PurchaseAffordance {
  /** May the app navigate the user to an external purchase page? */
  canLinkOut: boolean;
  /**
   * May the app say that plans exist and where they are managed?
   *
   * True wherever there is something to buy. Play's settlement explicitly
   * stopped prohibiting developers from communicating about other payment
   * methods, and refusing to explain why a limit was hit would be worse for the
   * user than any rule requires.
   *
   * False only while the product sells nothing at all — mentioning a plan that
   * does not exist yet is not a policy problem, it is a lie.
   */
  canMentionPlans: boolean;
}

/**
 * Decide what the purchase UI is allowed to do.
 *
 * @param platform       React Native's Platform.OS.
 * @param channel        The build channel, from EXPO_PUBLIC_DISTRIBUTION.
 * @param billingEnabled Whether this build sells anything at all.
 */
export function purchaseAffordance(
  platform: string,
  channel: Channel,
  billingEnabled = true,
): PurchaseAffordance {
  // Nothing is for sale, so there is nothing to link to and nothing to mention.
  // This is checked before the platform rules on purpose: it is a product
  // decision, and no channel may talk its way past it. Web in particular would
  // otherwise still show a paywall.
  if (!billingEnabled) return { canLinkOut: false, canMentionPlans: false };

  // Web is not distributed by a store and has no such rules, whatever the
  // channel string happens to say.
  if (platform === "web") return { canLinkOut: true, canMentionPlans: true };

  // Only a build we know is outside a store may link out. "unknown" is treated
  // as Play on purpose — an unconfigured build must not opt itself in.
  return { canLinkOut: channel === "direct", canMentionPlans: true };
}

/**
 * What to tell someone who has run out, given what this build may offer.
 *
 * @param resetHint e.g. "midnight UTC" — when a free allowance comes back.
 */
export function limitMessage(
  affordance: PurchaseAffordance,
  resetHint = "midnight UTC",
): { title: string; body: string; action: string | null } {
  if (affordance.canLinkOut) {
    return {
      title: "You have used today's builds",
      body: `Your allowance resets at ${resetHint}. A paid plan lifts the daily limit.`,
      action: "Update subscription",
    };
  }
  if (!affordance.canMentionPlans) {
    // Nothing is for sale, so the limit is simply the limit. Dangling an
    // upgrade that does not exist would be worse than the wait.
    return {
      title: "You have used today's builds",
      body: `Your allowance resets at ${resetHint}.`,
      action: null,
    };
  }

  return {
    title: "You have used today's builds",
    // No tap, so the sentence has to carry the whole answer — including where
    // to go, since the app cannot take them there.
    body:
      `Your allowance resets at ${resetHint}. ` +
      `Paid plans are managed from your account on the RetroAI website.`,
    action: null,
  };
}
