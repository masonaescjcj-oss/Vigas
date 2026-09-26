/**
 * frontend/src/screens/auth/SplashScreen.tsx
 * ---------------------------------------------------------------------------
 * The name, while the session is looked up.
 *
 * Routing is unchanged: once the auth store has initialised, a signed-in user
 * is taken over by RootNavigator and everyone else goes to Onboarding on first
 * run or Welcome after that.
 *
 * The strapline — "AI AGENT CODING & BUILDER SPACE" in tracked caps monospace —
 * is gone. The wordmark is the same one WelcomeScreen shows, so the first two
 * screens are one thing settling rather than two things in a row.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Splash">;

export const SplashScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, initialized } = useAuthStore();
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);

  useEffect(() => {
    if (!initialized) return;

    const timer = setTimeout(() => {
      // Onboarding is a first-run experience: once it has been seen (or
      // skipped) go straight to the sign-in screen on every later launch.
      if (!user) {
        navigation.replace(hasSeenOnboarding ? "Welcome" : "Onboarding");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [initialized, user, hasSeenOnboarding, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvasBase }} className="items-center justify-center px-6">
      <View className="flex-row items-baseline">
        <Text style={{ fontSize: 34, fontWeight: "500", letterSpacing: -0.6, color: colors.inkPrimary }}>
          retro
        </Text>
        <Text style={{ fontSize: 34, fontWeight: "500", letterSpacing: -0.6, color: colors.brandPrimary }}>
          ai
        </Text>
      </View>
      <ActivityIndicator color={colors.inkMuted} size="small" style={{ marginTop: 32 }} />
    </View>
  );
};
