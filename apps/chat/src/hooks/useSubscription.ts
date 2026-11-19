/**
 * frontend/src/hooks/useSubscription.ts
 * ---------------------------------------------------------------------------
 * Subscription state. The server side is real (subscriptions table +
 * revenuecat-webhook / revenuecat-sync), but there is NO purchase client yet:
 * `react-native-purchases` is not installed and no store products are
 * configured, so nothing here can actually charge a card or grant a tier.
 *
 * This hook therefore reports the real tier from `profiles` and refuses to
 * pretend a purchase happened. It used to `setTimeout(1500)` and then announce
 * "payment successful", which is the worst possible lie in an app: the user
 * believes they paid, nothing was charged, and no entitlement was granted.
 *
 * To finish this: install react-native-purchases, configure products in App
 * Store Connect / Play Console + RevenueCat, then implement purchase() here and
 * let revenuecat-webhook write the tier.
 * ---------------------------------------------------------------------------
 */

import { useState } from "react";
import { notify } from "../services/notify";
import { useAuthStore } from "../stores/authStore";

export interface SubscriptionPackage {
  id: string;
  title: string;
  priceString: string;
  period: "monthly" | "yearly";
  savings?: string;
}

/** True once a purchase SDK + store products are wired up. */
export const PURCHASES_AVAILABLE = false;

const NOT_AVAILABLE_TITLE = "Purchases not available yet";
const NOT_AVAILABLE_BODY =
  "In-app purchases aren't wired up in this build. No payment was attempted and nothing was charged.";

export const useSubscription = () => {
  const { profile, loadProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // No store connection yet, so there are no offerings to show.
  const offerings: SubscriptionPackage[] = [];

  const purchasePackage = async (_pkg: SubscriptionPackage) => {
    notify(NOT_AVAILABLE_TITLE, NOT_AVAILABLE_BODY);
  };

  const restorePurchases = async () => {
    // Refreshing the profile is genuinely useful: if a subscription was granted
    // server-side (webhook/sync), this picks it up.
    setLoading(true);
    try {
      await loadProfile();
      notify("Refreshed", "Your subscription status has been re-read from the server.");
    } finally {
      setLoading(false);
    }
  };

  return {
    offerings,
    purchasesAvailable: PURCHASES_AVAILABLE,
    isLoading: loading,
    activeSubscription: profile?.subscription_tier || "free",
    purchasePackage,
    restorePurchases,
  };
};
