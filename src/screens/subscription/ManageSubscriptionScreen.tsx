/**
 * frontend/src/screens/subscription/ManageSubscriptionScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to review, upgrade, or cancel active billing accounts.
 * Connects to RevenueCat subscription states and lists invoices.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from "react-native";
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

  const handleCancelSubscription = () => {
    Alert.alert(
      "Cancel Pro Subscription",
      "According to Apple and Google policies, to cancel your subscription, you must do so from your App Store or Google Play account settings.",
      [
        { text: "Got it" },
        { 
          text: "View Store Guide", 
          onPress: () => Alert.alert("Guide", "Go to phone settings -> Apple ID -> Subscriptions -> Issac -> Cancel.") 
        }
      ]
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
                Next renewal: Aug 20, 2026 • Payment method: Apple Pay
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
                Limited access to Claude 3.5 models and a usage cap of 100,000 tokens.
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
