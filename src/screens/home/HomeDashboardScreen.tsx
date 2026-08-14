/**
 * frontend/src/screens/home/HomeDashboardScreen.tsx
 * ============================================================================
 * PURE UI/UX PRESENTATIONAL SCREEN — (NO BUSINESS LOGIC / NO API CALLS)
 * ============================================================================
 * This screen is a pure visual layout showcase for the Home Dashboard.
 * It renders static UI components, progress bars, cards, and recent projects
 * using local mock props for 100% clean UI design demonstration.
 * ============================================================================
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { MOCK_USER_PROFILE, MOCK_PROJECTS } from "../../services/mockData";
import { type ProjectNavigationProp } from "../../navigation/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const HomeDashboardScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<ProjectNavigationProp>();

  // Static Mock UI Data (Pure Presentation)
  const profile = MOCK_USER_PROFILE;
  const projects = MOCK_PROJECTS;
  const tokensUsed = profile.tokens_used;
  const tokensLimit = profile.plan_limit_tokens;
  const isFree = profile.subscription_tier === "free";

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-5 py-4">
        
        {/* 1. Header & Welcome Text */}
        <View className="mb-6 items-start">
          <Text variant="caption">خوش آمدید</Text>
          <Text variant="h2" className="font-uiSemiBold">
            {profile.display_name} 👋
          </Text>
        </View>

        {/* 2. Upgrade to Pro Banner (UI Card) */}
        {isFree && (
          <View 
            className="p-5 rounded-card border-2 mb-6 items-start shadow-sm"
            style={{ 
              borderColor: colors.brandPrimary, 
              backgroundColor: `${colors.brandPrimary}08` 
            }}
          >
            <Text variant="h3" className="font-uiSemiBold" style={{ color: colors.brandPrimary }}>
              ارتقا به نسخه حرفه‌ای (Pro)
            </Text>
            <Text variant="caption" className="text-left mt-1.5 opacity-90 leading-5">
              دسترسی به سرعت بالا، مدل‌های GPT-4o و Claude 3.5 Sonnet، و رم اختصاصی ساندباکس.
            </Text>
            <Button 
              label="مشاهده پلن‌های اشتراک" 
              onPress={() => navigation.navigate("Paywall" as any)}
              className="mt-4 w-full"
            />
          </View>
        )}

        {/* 3. Token Consumption Progress Card */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-left">میزان مصرف توکن این ماه</Text>
          <View className="mt-3">
            <Text variant="h3" className="font-uiMedium text-left">
              {tokensUsed.toLocaleString()} / {tokensLimit.toLocaleString()} توکن
            </Text>
            {/* Progress Bar */}
            <View className="h-2 w-full bg-surfaceCode rounded-full mt-3 overflow-hidden" style={{ backgroundColor: colors.surfaceCode }}>
              <View 
                className="h-full rounded-full"
                style={{ 
                  backgroundColor: colors.brandPrimary,
                  width: `${Math.min((tokensUsed / tokensLimit) * 100, 100)}%` 
                }}
              />
            </View>
          </View>
        </View>

        {/* 4. Quick Start Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("NewProject")}
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6 items-center flex-row justify-between"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          activeOpacity={0.8}
        >
          <Text variant="h3" className="font-uiMedium" style={{ color: colors.brandPrimary }}>
            🚀 ساخت پروژه جدید
          </Text>
          <Text className="text-xl">➔</Text>
        </TouchableOpacity>

        {/* 5. Recent Projects Carousel (Pure UI Layout) */}
        <View className="mb-6">
          <Text variant="label" className="text-left mb-3">پروژه‌های اخیر</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
            {projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => navigation.navigate("ChatSession", { projectId: p.id })}
                className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mr-3 items-start justify-between"
                style={{ 
                  width: SCREEN_WIDTH * 0.48, 
                  height: 120,
                  backgroundColor: colors.surfaceRaised, 
                  borderColor: colors.borderHairline 
                }}
                activeOpacity={0.85}
              >
                <Text variant="body" className="font-uiMedium text-left" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="caption" className="opacity-70 text-[11px]" numberOfLines={2}>
                  {p.description}
                </Text>
                <Text variant="caption" className="opacity-50 text-[9px]">
                  {new Date(p.last_opened_at).toLocaleDateString("fa-IR")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 6. System Announcement Card */}
        <View className="bg-surfaceRaised p-4 rounded-card border border-borderHairline flex-row justify-between items-center" style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}>
          <Text className="text-base">📢</Text>
          <Text variant="caption" className="text-left flex-1 pl-2 opacity-80">
            سیستم ساندباکس به آخرین نسخه سیستم‌عامل به‌روزرسانی شد.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
