/**
 * frontend/src/screens/auth/EmailVerificationPendingScreen.tsx
 * ---------------------------------------------------------------------------
 * Waiting for a confirmation that arrives by link, not by code.
 *
 * Nothing in the app navigates here any more — sign-up goes to VerifyCode —
 * but the route is still registered and a stale deep link could land on it, so
 * it should look like the same app when it does. Every label was `text-white`
 * or `text-zinc-400`, which on the light theme is a blank screen.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { View, SafeAreaView } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { notify } from "../../services/notify";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../theme/ThemeProvider";

type RouteProps = RouteProp<AuthStackParamList, "EmailVerificationPending">;

const COOLDOWN_SECONDS = 60;

export const EmailVerificationPendingScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { email } = route.params;

  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown === 0) return;
    const interval = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      // auth.resend, not signUp — signUp would try to create a second account
      // with a throwaway password.
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      notify("Sent", "We sent the email again.");
      setCooldown(COOLDOWN_SECONDS);
    } catch (e: unknown) {
      notify("Could not resend", e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="" divider={false} onBack={() => navigation.navigate("Login")} />
      <View className="flex-1 px-6 pb-6">
        <View className="mb-8 mt-2">
          <Text variant="h1" className="font-uiSemiBold">Check your email</Text>
          <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            We sent a confirmation link to{" "}
            <Text variant="body" className="font-uiMedium" style={{ color: colors.inkPrimary }}>{email}</Text>.
            Open it on this device to finish creating your account.
          </Text>
        </View>

        <Button
          label={cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
          tone="neutral"
          block
          loading={resending}
          disabled={cooldown > 0}
          onPress={() => void handleResend()}
        />
        <View style={{ height: 10 }} />
        <Button label="Back to sign in" tone="ghost" block onPress={() => navigation.navigate("Login")} />
      </View>
    </SafeAreaView>
  );
};
