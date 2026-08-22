/**
 * frontend/src/screens/subscription/ManageSubscriptionScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to review, upgrade, or cancel active billing accounts.
 * Shows the tier recorded on the profile. Receipts and renewal dates live
 * with Apple/Google/RevenueCat — there is no invoice endpoint here, so none
 * are listed.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Platform, SafeAreaView } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";

interface Invoice {
  id: string;
  amount: string;
  date: string;
  status: "paid" | "failed";
}

export const ManageSubscriptionScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useAuthStore();

  // Receipts live with Apple/Google/RevenueCat; there is no invoice endpoint in
  // this backend, so the list stays empty rather than showing invented charges.
  const [invoices] = useState<Invoice[]>([]);

  const handleCancelSubscription = async () => {
    const wantsSteps = await confirmAction(
      "Cancel Pro subscription",
      "Apple and Google require subscriptions to be cancelled from your App Store or Google Play account settings.",
      { confirmLabel: "Show me how", cancelLabel: "Got it" },
    );
    if (!wantsSteps) return;
    notify(
      "Where to cancel",
      Platform.OS === "ios"
        ? "Settings → your name → Subscriptions → Retro Code → Cancel."
        : "Play Store → profile → Payments and subscriptions → Subscriptions → Retro Code → Cancel.",
    );
  };

  const isPro = profile?.subscription_tier === "pro" || profile?.subscription_tier === "team";

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Manage Subscription</Text>
          <View className="w-10" />
        </View>

        {/* Current Plan Card */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-left">Active Account</Text>
          <Text variant="h2" className="font-uiSemiBold text-left mt-2 text-brandPrimary" style={{ color: colors.brandPrimary }}>
            {isPro ? "Pro Account" : "Free Plan"}
          </Text>
          {isPro ? (
            <React.Fragment>
              <Text variant="caption" className="text-left opacity-80 mt-1">
                Your renewal date and payment method are held by the store you
                subscribed through — check them there.
              </Text>
              <Button
                label="Cancel Subscription"
                variant="secondary"
                onPress={handleCancelSubscription}
                className="mt-6 border-red-500/20"
                style={{ borderColor: `${colors.failed}30` }}
              />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Text variant="caption" className="text-left opacity-80 mt-1">
                A daily token allowance, with the standard models.
              </Text>
              <Button
                label="Upgrade to Pro"
                onPress={() => navigation.navigate("Paywall", {})}
                className="mt-6 w-full"
              />
            </React.Fragment>
          )}
        </View>

        {/* Invoice list */}
        {isPro && (
          <View className="mt-4">
            <Text variant="label" className="text-left mb-4">Invoices & Payment History</Text>
            {invoices.map((inv) => (
              <View 
                key={inv.id}
                className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3 flex-row justify-between items-center"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
              >
                <View className="items-start">
                  <Text variant="body" className="font-uiMedium">
                    {inv.amount} • {inv.id}
                  </Text>
                  <Text variant="caption" className="opacity-70 mt-0.5">
                    Transaction Date: {inv.date}
                  </Text>
                </View>

                <Text variant="caption" className="text-green-600 font-uiMedium" style={{ color: colors.success }}>
                  ✓ Paid
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};
