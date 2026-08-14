/**
 * frontend/src/screens/auth/OnboardingScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) INTRODUCTORY ONBOARDING CAROUSEL
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 */

import React, { useState } from "react";
import { View, SafeAreaView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { type AuthStackParamList } from "../../navigation/types";
import { useThemeStore } from "../../theme/store";

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

  const isLight = mode === "light";
  const bgCanvas = isLight ? "#FFFFFF" : "#000000";
  const bgCard = isLight ? "#F8FAFC" : "#141414";
  const bgItem = isLight ? "#F1F5F9" : "#1E1E22";
  const textPrimary = isLight ? "#0F172A" : "#FFFFFF";
  const textSecondary = isLight ? "#475569" : "#D4D4D8";

  const slides: Slide[] = [
    {
      title: "Autonomous AI Agent IDE",
      subtitle: "Full-Stack Code Generation & Execution",
      desc: "Retro Code plans, writes, tests, and debugs React, React Native, and Deno backend applications inside isolated cloud containers.",
      badge: "RETRO CODE ENGINE",
      badgeColor: "#C084FC",
      heroEmblems: ["⚙️", "💻", "⚡"],
    },
    {
      title: "Skills.sh Open Ecosystem",
      subtitle: "1,000+ Procedural Agent Skill Modules",
      desc: "Access UI design rules, vector icon mastery, state management, and automated Playwright & Jest test generators with zero configuration.",
      badge: "FEATURED ECOSYSTEM",
      badgeColor: "#38BDF8",
      heroEmblems: ["🧩", "🎨", "🚀"],
    },
    {
      title: "Checkpoints & Rollbacks",
      subtitle: "Atomic Version Timeline & Live Preview",
      desc: "Every code change creates an automatic Git checkpoint hash. Preview live web & mobile artifacts and restore code with one click.",
      badge: "SAFE & ISOLATED",
      badgeColor: "#10B981",
      heroEmblems: ["↺", "🛡️", "👁️"],
    },
  ];

  const handleNext = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      navigation.replace("Welcome");
    }
  };

  const handleSkip = () => {
    navigation.replace("Welcome");
  };

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
        <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#E2E8F0" : "transparent" }} className="w-full p-6 rounded-3xl items-center mb-8 shadow-xl relative border">
          <View className="flex-row space-x-4 mb-4">
            {slide.heroEmblems.map((emblem, eIdx) => (
              <View key={eIdx} style={{ backgroundColor: bgItem }} className="w-14 h-14 rounded-2xl items-center justify-center shadow-md mr-3 border border-slate-200/30">
                <Text className="text-2xl">{emblem}</Text>
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
                  backgroundColor: isActive ? "#C084FC" : (isLight ? "#CBD5E1" : "#27272A"),
                }}
              />
            );
          })}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
        >
          <Text className="text-white text-base font-bold tracking-wide">
            {activeSlide === slides.length - 1 ? "Get Started Now" : "Continue ➔"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
