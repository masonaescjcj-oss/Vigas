/**
 * frontend/src/screens/auth/OnboardingScreen.tsx
 * ============================================================================
 * INTRODUCTORY ONBOARDING CAROUSEL
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 */

import React, { useState } from "react";
import { View, SafeAreaView, TouchableOpacity } from "react-native";
import { Icon } from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { type AuthStackParamList } from "../../navigation/types";
import { useThemeStore } from "../../theme/store";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Onboarding">;

interface Slide {
  title: string;
  subtitle: string;
  desc: string;
  badge: string;
  badgeColor: string;
  heroEmblems: string[];
}

export const OnboardingScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeSlide, setActiveSlide] = useState(0);
  const { mode } = useThemeStore();
  const { colors } = useTheme();

  const isLight = mode === "light";
  const bgCanvas = colors.canvasBase;
  const bgCard = colors.surfaceRaised;
  const bgItem = colors.surfaceMuted;
  const textPrimary = colors.inkPrimary;
  const textSecondary = colors.inkSecondary;

  const slides: Slide[] = [
    {
      title: "Build apps by describing them",
      subtitle: "The agent writes the code",
      desc: "Say what you want. Retro Code plans it, writes the files, runs the commands, and tells you what it changed — all from your phone.",
      badge: "AI AGENT",
      badgeColor: colors.brandPrimary,
      heroEmblems: ["sparkles", "code", "zap"],
    },
    {
      title: "Start from a template",
      subtitle: "Landing page, todo, gallery, blog, quiz",
      desc: "Pick a starter and the agent edits it instead of writing everything from scratch — faster, cheaper, and far more predictable.",
      badge: "TEMPLATES",
      badgeColor: colors.brandPrimary,
      heroEmblems: ["layers", "folder", "edit"],
    },
    {
      title: "See it running instantly",
      subtitle: "Live preview on your device",
      desc: "Your app is bundled and rendered right here — no server, no waiting. Change something and look again.",
      badge: "LIVE PREVIEW",
      badgeColor: colors.success,
      heroEmblems: ["eye", "mobile", "check"],
    },
  ];

  const { setHasSeenOnboarding } = useSettingsStore();

  const finish = () => {
    setHasSeenOnboarding(true);
    navigation.replace("Welcome");
  };

  const handleNext = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      finish();
    }
  };

  const handleSkip = finish;

  const slide = slides[activeSlide];

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1 justify-between px-6 py-6">
      
      {/* Top Header */}
      <View className="flex-row justify-between items-center mt-2">
        <View className="flex-row items-center">
          <Text style={{ color: textPrimary }} className="text-lg font-bold tracking-widest font-mono">RETRO CODE</Text>
          <View className="bg-purple-950 px-2.5 py-0.5 rounded-full ml-2">
            <Text className="text-purple-300 text-[11px] font-mono font-bold">PRO</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleSkip} style={{ backgroundColor: bgItem }} className="py-2 px-4 rounded-full active:opacity-80 border border-slate-200/40">
          <Text style={{ color: textPrimary }} className="text-xs font-bold">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Hero Object Card */}
      <View className="items-center px-2 my-auto">
        
        {/* Rich Multi-Emblem Hero Visual Object Card */}
        <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="w-full p-6 rounded-3xl items-center mb-8 shadow-xl relative border">
          <View className="flex-row space-x-4 mb-4">
            {slide.heroEmblems.map((emblem, eIdx) => (
              <View key={eIdx} style={{ backgroundColor: bgItem }} className="w-14 h-14 rounded-2xl items-center justify-center shadow-md mr-3 border border-slate-200/30">
                <Icon name={emblem} size={24} color={slide.badgeColor} />
              </View>
            ))}
          </View>

          <View className="bg-purple-950/80 px-4 py-1.5 rounded-full border border-purple-500/30">
            <Text style={{ color: slide.badgeColor }} className="text-[11px] font-mono font-bold tracking-wider uppercase">
              {slide.badge}
            </Text>
          </View>
        </View>

        {/* Large Prominent Titles & Typography */}
        <Text style={{ color: textPrimary }} className="text-3xl font-extrabold text-center leading-9 mb-2 font-sans">
          {slide.title}
        </Text>

        <Text className="text-purple-500 text-base font-semibold text-center mb-4">
          {slide.subtitle}
        </Text>

        <Text style={{ color: textSecondary }} className="text-sm text-center leading-6 max-w-[95%]">
          {slide.desc}
        </Text>
      </View>

      {/* Footer controls */}
      <View className="mb-6">
        {/* Dot Indicators */}
        <View className="flex-row justify-center space-x-2 mb-6">
          {slides.map((_, idx) => {
            const isActive = idx === activeSlide;
            return (
              <View
                key={idx}
                className="h-2.5 rounded-full mx-1"
                style={{
                  width: isActive ? 28 : 10,
                  backgroundColor: isActive ? colors.brandPrimary : (colors.borderHairline),
                }}
              />
            );
          })}
        </View>

        {/* Action Button */}
        <TouchableOpacity style={{ backgroundColor: colors.brandPrimary }}
          onPress={handleNext}
          className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
        >
          <Text className="text-white text-base font-bold tracking-wide">
            {activeSlide === slides.length - 1 ? "Get Started Now" : "Continue ➔"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
