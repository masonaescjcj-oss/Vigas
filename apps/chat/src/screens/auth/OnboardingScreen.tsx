/**
 * frontend/src/screens/auth/OnboardingScreen.tsx
 * ---------------------------------------------------------------------------
 * Three sentences before the door.
 *
 * It was a purple "PRO" chip, a monospace wordmark in caps, three icon tiles in
 * a card, a purple "AI AGENT" badge, an extrabold title, a purple subtitle and
 * a button reading "Continue ➔". Seven things competing to be looked at on a
 * screen whose only job is to say what the app does and get out of the way.
 *
 * Now: the name, a statement, a line under it, three dots, one button.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, SafeAreaView, TouchableOpacity, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { type AuthStackParamList } from "../../navigation/types";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Onboarding">;

const SLIDES = [
  {
    title: "Build apps by describing them",
    body: "Say what you want. The agent plans it, writes the files, runs the commands and tells you what changed.",
  },
  {
    title: "It works on real projects",
    body: "Start from nothing or from what you already have. Fix a failing test, add a feature, or scaffold a whole shop with a backend.",
  },
  {
    title: "See it running here",
    body: "Your app renders on your device as it is built. Share it with a link, or download the source and take it anywhere.",
  },
];

const goToVigasSite = () => {
  const win = globalThis as unknown as { location?: { assign?: (url: string) => void } };
  win.location?.assign?.("/");
};

export const OnboardingScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { setHasSeenOnboarding } = useSettingsStore();
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = () => {
    setHasSeenOnboarding(true);
    navigation.replace("Welcome");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <View className="flex-1 px-6 pt-4 pb-6">
        {/* Name on the left, the way out on the right. Nothing else up here. */}
        <View className="flex-row items-center justify-between" style={{ height: 44 }}>
          {Platform.OS === "web" ? (
            <TouchableOpacity onPress={goToVigasSite} accessibilityRole="link" activeOpacity={0.7}>
              <Text variant="label" style={{ fontSize: 12, letterSpacing: 0.6, color: colors.inkSecondary }}>
                ← vigas.app
              </Text>
            </TouchableOpacity>
          ) : (
            <Text variant="label" style={{ fontSize: 12, letterSpacing: 0.6 }}>vigas chat</Text>
          )}
          <Button label="Skip" tone="ghost" size="sm" onPress={finish} />
        </View>

        {/* The statement. Large but not heavy; the weight is the point size. */}
        <View className="flex-1 justify-center">
          <Text variant="h1" style={{ fontSize: 42, lineHeight: 46, letterSpacing: -1.8 }}>
            {slide.title}
          </Text>
          <Text
            variant="body"
            className="mt-4"
            style={{ fontSize: 16, lineHeight: 24, color: colors.inkSecondary }}
          >
            {slide.body}
          </Text>
        </View>

        {/* Dots, then the one button. */}
        <View className="flex-row justify-center mb-6">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className="h-1.5 rounded-pill mx-1"
              style={{
                width: i === index ? 20 : 6,
                backgroundColor: i === index ? colors.inkPrimary : colors.surfaceStrong,
              }}
            />
          ))}
        </View>

        <Button
          label={last ? "Get started" : "Continue"}
          block
          onPress={() => (last ? finish() : setIndex(index + 1))}
        />
      </View>
    </SafeAreaView>
  );
};
