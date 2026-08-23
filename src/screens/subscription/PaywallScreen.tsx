/**
 * frontend/src/screens/subscription/PaywallScreen.tsx
 * ---------------------------------------------------------------------------
 * High-converting Paywall Screen:
 *   - Introduces value props (unlimited tokens, advanced model access).
 *   - Monthly/Yearly selection with highlighted savings.
 *   - Default pre-selected Yearly card (industry best practice).
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { Icon } from "../../components/Icon";
import { type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { PlanCard } from "../../components/PlanCard";
import { useTheme } from "../../theme/ThemeProvider";
import { useSubscription } from "../../hooks/useSubscription";
import { notify } from "../../services/notify";
import { startCheckout } from "../../services/checkoutService";
import { DISPLAY_PLANS } from "../../core/billing/plans";

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
  // Close means close. This used to swallow the first dismissal to show a
  // discount that existed in no store — a fabricated price, and a screen you
  // could not leave on the first try.
  const handleClose = () => navigation.goBack();

  const handlePurchase = async () => {
    const pkg = offerings.find((o) => o.id === selectedPkgId);
    // No store connection — which is the normal case now, because the plan is
    // sold on the web rather than through Play Billing. Hand off to the
    // browser: the URL carries a payment reference, not a session, so nothing
    // that could reach the account travels with it.
    if (!pkg) {
      setStarting(true);
      try {
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
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header Close button */}
        <View className="flex-row justify-between items-center mb-6">
          <TouchableOpacity onPress={handleClose} className="p-2 w-8 h-8 rounded-full items-center justify-center bg-surfaceRaised border border-borderHairline" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
            <Text variant="caption" className="font-uiSemiBold text-[12px]">X</Text>
          </TouchableOpacity>
          <Text variant="h3" className="font-uiSemiBold">Upgrade</Text>
        </View>

        {/* Visual Header */}
        <View className="items-center mb-8">
          <Icon name="sparkles" size={52} color={colors.brandPrimary} style={{ marginBottom: 16 }} />
          <Text variant="h2" className="font-uiSemiBold text-center">
            {/* Named when a specific model sent them here: someone who tapped
                "DeepSeek Reasoner" is owed an answer about that model, not a
                generic pitch they have to translate. */}
            {lockedModel ? `${lockedModel} needs ${requiredPlanName}` : "Access all Pro features"}
          </Text>
          <Text variant="caption" className="text-center mt-2 opacity-80 leading-5 px-6">
            {lockedModel
              ? `Your plan does not include it yet. ${requiredPlanName} unlocks it along with everything below.`
              : "Remove limits and code at the fastest speed."}
          </Text>
        </View>

        {/* Value features checklists */}
        <View className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6 space-y-3" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
          {[
            "No daily token cap",
            "Every model in the picker, including the reasoning models",
            "Longer agent runs before they are cut short",
          ].map((feature) => (
            <View key={feature} className="flex-row justify-start items-center mt-2">
              <Text className="text-base text-green-500 mr-3">✓</Text>
              <Text variant="body" className="font-uiMedium text-left flex-1">{feature}</Text>
            </View>
          ))}
        </View>

        {/* Plan Cards list */}
        <View className="mb-6">
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
        </View>

        {/* Main CTA */}
        <Button
          label={offerings.length > 0 ? "Unlock Pro" : "Continue in browser"}
          onPress={handlePurchase}
          loading={isLoading || starting}
          className="w-full mt-4 py-4"
        />

        {/* Micro-copy. Says where payment happens, because being sent out of
            the app is surprising if it is not announced first — and Google's
            link-out rules expect it to be disclosed. */}
        <Text variant="caption" className="text-center mt-4 opacity-60 leading-5">
          {offerings.length > 0
            ? "No commitment • Cancel anytime from your store's subscription settings"
            : "Payment opens in your browser and is handled outside the app store. Crypto accepted."}
        </Text>

      </ScrollView>


    </SafeAreaView>
  );
};
