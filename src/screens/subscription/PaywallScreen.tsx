/**
 * frontend/src/screens/subscription/PaywallScreen.tsx
 * ---------------------------------------------------------------------------
 * High-converting Paywall Screen:
 *   - Introduces value props (unlimited tokens, advanced model access).
 *   - Monthly/Yearly selection with highlighted savings.
 *   - Default pre-selected Yearly card (industry best practice).
 *   - Exit Offer: triggers a 20% discount offer overlay modal when closing.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TouchableOpacity, ScrollView, Modal, Alert, SafeAreaView } from "react-native";
import { Icon } from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { PlanCard } from "../../components/PlanCard";
import { useTheme } from "../../theme/ThemeProvider";
import { useSubscription, type SubscriptionPackage } from "../../hooks/useSubscription";

export const PaywallScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { offerings, purchasePackage, isLoading } = useSubscription();

  const [selectedPkgId, setSelectedPkgId] = useState("pkg_yearly"); // default selected
  const [showExitOffer, setShowExitOffer] = useState(false);
  const [hasClosedOnce, setHasClosedOnce] = useState(false);

  const handleClose = () => {
    if (!hasClosedOnce) {
      // Trigger Exit Offer before letting them dismiss!
      setShowExitOffer(true);
      setHasClosedOnce(true);
    } else {
      navigation.goBack();
    }
  };

  const handlePurchase = async () => {
    const pkg = offerings.find((o) => o.id === selectedPkgId);
    if (!pkg) return;
    await purchasePackage(pkg);
    navigation.goBack();
  };

  const handleAcceptExitOffer = async () => {
    setShowExitOffer(false);
    // Trigger discount purchase
    const discountPkg: SubscriptionPackage = {
      id: "pkg_yearly_discount",
      title: "Pro Yearly (20% Off Discount)",
      priceString: "$119.99",
      period: "yearly"
    };
    await purchasePackage(discountPkg);
    navigation.goBack();
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
          <View className="flex-row justify-start items-center">
            <Text className="text-base text-green-500 mr-3">✓</Text>
            <Text variant="body" className="font-uiMedium text-left">Unlimited tokens per month</Text>
          </View>
          <View className="flex-row justify-start items-center mt-2">
            <Text className="text-base text-green-500 mr-3">✓</Text>
            <Text variant="body" className="font-uiMedium text-left">Access to Claude 3.5 & GPT-4o</Text>
          </View>
          <View className="flex-row justify-start items-center mt-2">
            <Text className="text-base text-green-500 mr-3">✓</Text>
            <Text variant="body" className="font-uiMedium text-left">Faster Sandboxes with dedicated RAM</Text>
          </View>
          <View className="flex-row justify-start items-center mt-2">
            <Text className="text-base text-green-500 mr-3">✓</Text>
            <Text variant="body" className="font-uiMedium text-left">Unlimited project checkpoint history</Text>
          </View>
        </View>

        {/* Plan Cards list */}
        <View className="mb-6">
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
          No commitment • Cancel anytime from store settings • Secure payment via RevenueCat
        </Text>

      </ScrollView>

      {/* Exit Offer Modal overlay */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showExitOffer}
        onRequestClose={() => setShowExitOffer(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View 
            className="p-6 rounded-t-card border-t border-borderHairline"
            style={{ backgroundColor: colors.surfaceRaised, borderTopColor: colors.borderHairline }}
          >
            <Icon name="zap" size={44} color="#F59E0B" style={{ marginBottom: 12, alignSelf: "center" }} />
            <Text variant="h2" className="font-uiSemiBold text-center text-brandPrimary" style={{ color: colors.brandPrimary }}>
              Special Offer: 20% Off!
            </Text>
            <Text variant="body" className="text-center mt-2 px-6 leading-5 opacity-90">
              Would you like to get the Pro annual subscription with a special 20% discount for only $119.99 instead of $149.99?
            </Text>

            <View className="space-y-3 mt-6">
              <Button
                label="Yes, apply discount"
                onPress={handleAcceptExitOffer}
                className="w-full py-3.5"
              />
              <Button
                label="No, close screen"
                variant="secondary"
                onPress={() => {
                  setShowExitOffer(false);
                  navigation.goBack();
                }}
                className="w-full"
              />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};
