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
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { PlanCard } from "../../components/PlanCard";
import { useTheme } from "../../theme/ThemeProvider";
import { useSubscription } from "../../hooks/useSubscription";
import { notify } from "../../services/notify";

export const PaywallScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { offerings, purchasePackage, isLoading } = useSubscription();

  const [selectedPkgId, setSelectedPkgId] = useState("pkg_yearly"); // default selected
  // Close means close. This used to swallow the first dismissal to show a
  // discount that existed in no store — a fabricated price, and a screen you
  // could not leave on the first try.
  const handleClose = () => navigation.goBack();

  const handlePurchase = async () => {
    const pkg = offerings.find((o) => o.id === selectedPkgId);
    // With no store connection there are no offerings, so this used to return
    // silently and the button did nothing. Say what is happening instead.
    if (!pkg) {
      notify(
        "Purchases not available yet",
        "This build has no store connection, so there is nothing to buy. Nothing was charged.",
      );
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
          <Icon name="sparkles" size={52} color="#C084FC" style={{ marginBottom: 16 }} />
          <Text variant="h2" className="font-uiSemiBold text-center">
            Access all Pro features
          </Text>
          <Text variant="caption" className="text-center mt-2 opacity-80 leading-5 px-6">
            Remove limits and code at the fastest speed.
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
          {offerings.length === 0 && (
            <Text variant="caption" className="text-center opacity-60 leading-5 py-4">
              Plans appear here once the app is connected to the App Store and Google Play.
            </Text>
          )}
          {offerings.map((pkg) => (
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
          label="Unlock Pro"
          onPress={handlePurchase}
          loading={isLoading}
          className="w-full mt-4 py-4"
        />

        {/* Micro-copy disclaimer */}
        <Text variant="caption" className="text-center mt-4 opacity-60 leading-5">
          No commitment • Cancel anytime from your store's subscription settings
        </Text>

      </ScrollView>


    </SafeAreaView>
  );
};
