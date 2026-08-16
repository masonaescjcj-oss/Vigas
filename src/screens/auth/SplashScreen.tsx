/**
 * frontend/src/screens/auth/SplashScreen.tsx
 * ============================================================================
 * MINIMALIST SPLASH & INITIAL LOADING SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 * 
 * DEVELOPER LOGIC & FLOW:
 * 1. INITIALIZATION CHECK:
 *    Inspects `useAuthStore` initialization state.
 * 2. SESSION ROUTING:
 *    - If session active (user logged in) -> RootNavigator routes to MainTabs.
 *    - If unauthenticated -> Transitions smoothly to `OnboardingScreen.tsx`.
 * ============================================================================
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
    <View 
      style={{ backgroundColor: colors.canvasBase }} 
      className="flex-1 items-center justify-center bg-black px-6"
    >
      <View className="items-center select-none">
        
        {/* Minimalist Title: retro code pro (No icon box) */}
        <View className="flex-row items-baseline justify-center mb-2">
          <Text 
            style={{ 
              fontSize: 34, 
              fontWeight: "300", 
              color: colors.inkPrimary, 
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif",
              letterSpacing: -1
            } as any}
          >
            retro code
          </Text>
          <Text 
            style={{ 
              fontSize: 26, 
              fontWeight: "500", 
              color: colors.brandPrimary, 
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif",
              marginLeft: 8,
              letterSpacing: -0.5
            } as any}
          >
            pro
          </Text>
        </View>

        {/* Soft Dim Subtitle */}
        <Text 
          style={{ 
            fontSize: 10, 
            fontWeight: "500", 
            color: colors.inkMuted, 
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
            opacity: 0.8
          } as any}
        >
          AI AGENT CODING & BUILDER SPACE
        </Text>

        {/* Smooth Purple Loading Spinner */}
        <ActivityIndicator 
          color={colors.brandPrimary} 
          size="small" 
          className="mt-8" 
        />
      </View>
    </View>
  );
};
