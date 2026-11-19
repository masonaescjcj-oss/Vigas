/**
 * frontend/src/screens/auth/WelcomeScreen.tsx
 * ---------------------------------------------------------------------------
 * The front of the instrument: a speaker grille with its light on, the name,
 * one sentence, a spec plate, and the two ways in.
 *
 * There was a third way in, "Continue as Guest", built on signInAnonymously().
 * It was removed rather than fixed: it needs anonymous sign-ins enabled on the
 * project, and an account that cannot receive a password reset is a dead end
 * for the user's projects rather than a shortcut into them.
 *
 * The spec plate is the label on the back of a device: three lines, legend on
 * the left, what it does on the right. It says what the app is in the words a
 * person would check it against, not in marketing.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, SafeAreaView, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";
import { BrandMark } from "../../components/ui/BrandMark";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import appConfig from "../../../app.json";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

const SPEC = [
  { legend: "chat", value: "ask about anything" },
  { legend: "build", value: "writes and runs real projects" },
  { legend: "preview", value: "watch it run as it is built" },
];

const goToVigasSite = () => {
  const win = globalThis as unknown as { location?: { assign?: (url: string) => void } };
  win.location?.assign?.("/");
};

export const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      {/* Scrolls rather than overlapping when a short screen cannot fit the
          plate and the ways in; on a phone it simply fills the screen. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View className="flex-1 px-6 pt-5 pb-7">
        <View className="flex-row justify-between items-center">
          {Platform.OS === "web" ? (
            <TouchableOpacity onPress={goToVigasSite} accessibilityRole="link" activeOpacity={0.7}>
              <Text variant="label" style={{ fontSize: 11, letterSpacing: 0.6, color: colors.inkSecondary }}>
                ← vigas.app
              </Text>
            </TouchableOpacity>
          ) : (
            <Text variant="label" style={{ fontSize: 11, letterSpacing: 0.6 }}>vigas chat</Text>
          )}
          <Text variant="label" style={{ fontSize: 11, letterSpacing: 0.6 }}>ai agent · v{appConfig.expo.version}</Text>
        </View>

        <View className="flex-1 justify-center" style={{ gap: 32 }}>
          {/* The reels fill only the middle of their square; the negative
              margin takes back the empty band above and below them. */}
          <View style={{ marginVertical: -48, alignSelf: "flex-start" }}>
            <BrandMark size={176} />
          </View>

          <View style={{ gap: 14 }}>
            <Text variant="h1" style={{ fontSize: 64, lineHeight: 64, letterSpacing: -3 }}>
              vigas<Text variant="h1" style={{ fontSize: 64, lineHeight: 64, color: colors.brandPrimary }}>.</Text>
            </Text>
            <Text variant="body" style={{ fontSize: 17, lineHeight: 26, color: colors.inkSecondary, maxWidth: 320 }}>
              Chat with frontier AI or describe an app — Vigas plans it, writes it, and runs it live.
            </Text>
          </View>

          <View accessibilityRole="list">
            {SPEC.map((row, i) => (
              <View
                key={row.legend}
                className="flex-row justify-between items-baseline"
                style={{
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderBottomWidth: i === SPEC.length - 1 ? 1 : 0,
                  borderColor: colors.borderHairline,
                }}
              >
                <Text variant="label">{row.legend}</Text>
                <Text variant="body" style={{ fontSize: 14 }}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <GoogleSignInButton />
          <Button label="Sign in" block onPress={() => navigation.navigate("Login")} />
          <Button label="Create an account" tone="neutral" block onPress={() => navigation.navigate("SignUp")} />
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};
