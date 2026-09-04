/**
 * frontend/src/screens/auth/WelcomeScreen.tsx
 * ---------------------------------------------------------------------------
 * Sign in or create an account — those are the only two ways in.
 *
 * There was a third, "Continue as Guest", built on signInAnonymously(). It was
 * removed rather than fixed: it needs anonymous sign-ins enabled on the project,
 * and an account that cannot receive a password reset is a dead end for the
 * user's projects rather than a shortcut into them.
 *
 * The screen was a card with a purple icon tile, three rows each on their own
 * surface, a monospace caps strapline and a turquoise "pro". It is now the
 * wordmark, three quiet lines about what the app does, and the two buttons.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

const POINTS = [
  { icon: "sparkles", text: "Describe an app; the agent writes it" },
  { icon: "eye", text: "Preview it on this device as it is built" },
  { icon: "folder", text: "Every file saved, versioned and yours to download" },
];

export const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <View className="flex-1 px-6 pt-4 pb-6">
        <View className="flex-1 justify-center">
          {/* One wordmark. "pro" is the same size and weight, one step dimmer —
              a label on the name, not a badge stuck to it. */}
          <View className="flex-row items-baseline">
            <Text style={{ fontSize: 34, fontWeight: "500", letterSpacing: -0.6, color: colors.inkPrimary }}>
              retro code
            </Text>
            <Text style={{ fontSize: 34, fontWeight: "500", letterSpacing: -0.6, color: colors.inkMuted, marginLeft: 9 }}>
              pro
            </Text>
          </View>

          <Text variant="body" className="mt-3" style={{ fontSize: 16, lineHeight: 24, color: colors.inkSecondary }}>
            An agent that builds software from a description, on your phone.
          </Text>

          <View className="mt-10">
            {POINTS.map((p) => (
              <View key={p.text} className="flex-row items-start mb-4">
                <Icon name={p.icon} size={18} color={colors.inkMuted} style={{ marginTop: 2, marginRight: 14 }} />
                <Text variant="body" className="flex-1" style={{ lineHeight: 22, color: colors.inkPrimary }}>
                  {p.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Button label="Sign in" block onPress={() => navigation.navigate("Login")} />
        <View style={{ height: 10 }} />
        <Button label="Create an account" tone="neutral" block onPress={() => navigation.navigate("SignUp")} />
      </View>
    </SafeAreaView>
  );
};
