/**
 * frontend/src/screens/auth/SplashScreen.tsx
 * ---------------------------------------------------------------------------
 * The logo, while the session is looked up.
 *
 * Routing is unchanged: once the auth store has initialised, a signed-in user
 * is taken over by RootNavigator and everyone else goes to Onboarding on first
 * run or Welcome after that.
 *
 * No words and no spinner: the reels mark alone, at the size the native launch
 * splash draws it (assets/splash.png, 320 of 1284 px across, which lands near
 * 104 pt on a phone). The launch image and this screen are then one frame, and
 * the app's name is left to the screen that follows.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BrandMark } from "../../components/ui/BrandMark";
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
      <BrandMark size={104} />
    </View>
  );
};
