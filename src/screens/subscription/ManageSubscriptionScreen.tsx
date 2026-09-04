/**
 * frontend/src/screens/subscription/ManageSubscriptionScreen.tsx
 * ---------------------------------------------------------------------------
 * The plan on the profile, and where to change it.
 *
 * Receipts and renewal dates live with Apple, Google or the web checkout —
 * there is no invoice endpoint in this backend, so none are listed. The screen
 * carried an "Invoices & Payment History" heading over an array that is always
 * empty; a heading with nothing under it reads as a page that failed to load.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, Platform, SafeAreaView } from "react-native";
import { confirmAction, notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";

export const ManageSubscriptionScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useAuthStore();

  const handleCancelSubscription = async () => {
    const wantsSteps = await confirmAction(
      "Cancel your subscription",
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
      <ScreenHeader title="Subscription" divider={false} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Card className="mt-2">
          <View className="flex-row items-center">
            <Text variant="h3" className="font-uiSemiBold flex-1">
              {isPro ? "Paid plan" : "Free plan"}
            </Text>
            <Pill tone={isPro ? "success" : "muted"}>{profile?.subscription_tier ?? "free"}</Pill>
          </View>

          <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            {isPro
              ? "Your renewal date and payment method are held by the store you subscribed through — check them there."
              : "A daily token allowance, with the standard models."}
          </Text>

          {isPro ? (
            <Button label="How to cancel" tone="neutral" size="sm" className="mt-4" onPress={() => void handleCancelSubscription()} />
          ) : (
            <Button label="See plans" size="sm" className="mt-4" onPress={() => navigation.navigate("Paywall", {})} />
          )}
        </Card>

        <Text variant="caption" className="px-1 mt-6" style={{ color: colors.inkMuted, lineHeight: 18 }}>
          Receipts are issued by whoever took the payment — the App Store, Google Play, or the web
          checkout. This app does not hold them.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
