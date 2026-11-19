/**
 * frontend/src/screens/subscription/PaywallScreen.tsx
 * ---------------------------------------------------------------------------
 * The plans, and the way to buy one.
 *
 * Nothing is for sale in this build — PURCHASES.canMentionPlans is false and
 * nothing navigates here — but the route is registered, so it should look like
 * the same app if a stale link reaches it.
 *
 * The pitch was a 52px brand sparkle over an "Access all Pro features"
 * headline, a checklist with green ✓ characters, and an "X" letter in a circle
 * for close. It is now a title, three lines, the plans as rows, one button.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { PlanCard } from "../../components/PlanCard";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useSubscription } from "../../hooks/useSubscription";
import { notify } from "../../services/notify";
import { startCheckout } from "../../services/checkoutService";
import { DISPLAY_PLANS } from "../../core/billing/plans";
import { track } from "../../services/analytics";

const INCLUDED = [
  "No daily token cap",
  "Every model in the picker, including the reasoning models",
  "Longer agent runs before they are cut short",
];

export const PaywallScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "Paywall">>();
  const { offerings, purchasePackage, isLoading } = useSubscription();

  // Set when a locked model sent the user here, so the screen can say which one.
  const lockedModel = route.params?.lockedModel;
  // Title-cased because the route carries a plan *key* ("pro"), and "Pro" is
  // what the plan is called.
  const requiredTier = route.params?.requiredTier ?? "pro";
  const requiredPlanName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);

  // Store packages when a store is connected, our own plans otherwise. Yearly
  // first either way, so the default selection is the one people should take.
  const plans = offerings.length > 0 ? offerings : DISPLAY_PLANS;
  const [selectedPkgId, setSelectedPkgId] = useState(plans[0]?.id ?? "pro_yearly");
  // Separate from the store hook's isLoading: this covers the web handoff,
  // which has its own round trip before the browser opens.
  const [starting, setStarting] = useState(false);

  // Which pitch a user saw matters more than that they saw one: arriving from a
  // locked model is a different intent from browsing to it.
  React.useEffect(() => {
    track("paywall_seen", { reason: lockedModel ? "locked_model" : "browsed" });
  }, [lockedModel]);

  const handlePurchase = async () => {
    const pkg = offerings.find((o) => o.id === selectedPkgId);
    // No store connection — which is the normal case now, because the plan is
    // sold on the web rather than through Play Billing. Hand off to the
    // browser: the URL carries a payment reference, not a session, so nothing
    // that could reach the account travels with it.
    if (!pkg) {
      setStarting(true);
      try {
        track("checkout_started", { plan: selectedPkgId });
        const reference = await startCheckout(selectedPkgId);
        if (reference) {
          notify(
            "Finish in your browser",
            "We opened the payment page. Your plan updates here as soon as the payment confirms — crypto can take a few minutes.",
          );
        }
      } finally {
        setStarting(false);
      }
      return;
    }
    try {
      await purchasePackage(pkg);
      navigation.goBack();
    } catch (e) {
      // A real purchase SDK rejects on cancel and on failure; leaving the user
      // on the paywall with an explanation beats an unhandled rejection.
      notify("Purchase did not complete", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      {/* Close means close. This used to swallow the first dismissal to show a
          discount that existed in no store — a fabricated price, and a screen
          you could not leave on the first try. */}
      <ScreenHeader title="" divider={false} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <View className="mb-7 mt-2">
          <Text variant="h1" className="font-uiSemiBold">
            {/* Named when a specific model sent them here: someone who tapped a
                reasoning model is owed an answer about that model, not a
                generic pitch they have to translate. */}
            {lockedModel ? `${lockedModel} needs ${requiredPlanName}` : "Remove the limits"}
          </Text>
          <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            {lockedModel
              ? `Your plan does not include it yet. ${requiredPlanName} unlocks it, along with everything below.`
              : "A paid plan lifts the daily cap and opens every model."}
          </Text>
        </View>

        <View className="mb-7">
          {INCLUDED.map((feature) => (
            <View key={feature} className="flex-row items-start mb-2.5">
              <Icon name="check" size={16} color={colors.success} style={{ marginTop: 3, marginRight: 12 }} />
              <Text variant="body" className="flex-1" style={{ lineHeight: 22 }}>{feature}</Text>
            </View>
          ))}
        </View>

        {plans.map((pkg) => (
          <PlanCard
            key={pkg.id}
            title={pkg.title}
            price={pkg.priceString}
            period={pkg.period}
            savings={pkg.savings}
            isSelected={selectedPkgId === pkg.id}
            onSelect={() => setSelectedPkgId(pkg.id)}
          />
        ))}

        <Button
          label={offerings.length > 0 ? "Subscribe" : "Continue in your browser"}
          block
          className="mt-5"
          loading={isLoading || starting}
          onPress={() => void handlePurchase()}
        />

        {/* Says where payment happens, because being sent out of the app is
            surprising if it is not announced first — and Google's link-out
            rules expect it to be disclosed. */}
        <Text variant="caption" className="text-center mt-4" style={{ color: colors.inkMuted, lineHeight: 18 }}>
          {offerings.length > 0
            ? "Cancel any time from your store's subscription settings."
            : "Payment opens in your browser and is handled outside the app store. Crypto accepted."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
