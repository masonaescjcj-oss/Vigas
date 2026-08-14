/**
 * frontend/src/screens/settings/SettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Settings Screen:
 *   - Swap theme modes (Light, Dark, Darkest) instantly.
 *   - Display subscription details (from RevenueCat sync).
 *   - Fetch usage metering stats from the database.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";

interface UsageStats {
  tokens_used: number;
  plan_limit_tokens: number;
}

export const SettingsScreen = () => {
  const { colors, mode, setMode } = useTheme();
  const { profile, signOut } = useAuthStore();
  
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Fetch usage stats from Supabase usage_metering table
  useEffect(() => {
    const fetchUsage = async () => {
      setLoadingUsage(true);
      try {
        const { data, error } = await supabase
          .from("usage_metering")
          .select("tokens_used, plan_limit_tokens")
          .maybeSingle();
        
        if (!error && data) {
          setUsage(data as UsageStats);
        }
      } catch (e) {
        console.error("Failed to load usage stats:", e);
      } finally {
        setLoadingUsage(false);
      }
    };

    void fetchUsage();
  }, []);

  // Theme option list
  const themeOptions: Array<{ key: typeof mode; label: string; desc: string }> = [
    { key: "light", label: "Light Mode", desc: "بژ کاغذی Perplexity" },
    { key: "dark", label: "Dark Mode", desc: "خاکی Claude" },
    { key: "darkest", label: "Darkest Mode", desc: "کنتراست سیاه عمیق Grok" },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header */}
        <View className="mb-6">
          <Text variant="h2" className="font-uiSemiBold">
            تنظیمات کاربری (Settings)
          </Text>
        </View>

        {/* Profile Details */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-right">پروفایل شما</Text>
          <Text variant="h3" className="font-uiMedium text-right mt-2">
            {profile?.display_name || "کاربر ایساک (User)"}
          </Text>
          <Text variant="caption" className="text-right opacity-80 mt-1">
            {profile?.email || "email@test.com"}
          </Text>

          {/* Subscription Badge */}
          <View className="flex-row justify-end mt-4">
            <View 
              className="py-1 px-3 rounded-pill"
              style={{ backgroundColor: `${colors.brandPrimary}20` }}
            >
              <Text variant="caption" className="font-uiMedium uppercase" style={{ color: colors.brandPrimary }}>
                سطح اشتراک: {profile?.subscription_tier || "free"}
              </Text>
            </View>
          </View>
        </View>

        {/* Usage Metering Stats */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-right">میزان مصرف توکن روزانه</Text>
          {loadingUsage ? (
            <ActivityIndicator size="small" color={colors.brandPrimary} className="mt-4" />
          ) : usage ? (
            <View className="mt-3">
              {/* Progress text */}
              <Text variant="h3" className="font-uiMedium text-right">
                {usage.tokens_used.toLocaleString()} / {usage.plan_limit_tokens.toLocaleString()} توکن
              </Text>
              
              {/* Progress bar container */}
              <View className="h-2 w-full bg-surfaceCode rounded-full mt-3 overflow-hidden" style={{ backgroundColor: colors.surfaceCode }}>
                <View 
                  className="h-full bg-brandPrimary rounded-full" 
                  style={{ 
                    backgroundColor: colors.brandPrimary,
                    width: `${Math.min((usage.tokens_used / usage.plan_limit_tokens) * 100, 100)}%`
                  }} 
                />
              </View>
            </View>
          ) : (
            <Text variant="caption" className="text-right opacity-70 mt-3">
              آماری برای دوره جاری ثبت نشده است.
            </Text>
          )}
        </View>

        {/* Theme Settings switcher */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-right mb-3">پوسته اپلیکیشن (App Theme)</Text>
          
          {themeOptions.map((opt) => {
            const isSelected = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setMode(opt.key)}
                className="flex-row items-center justify-between py-3 border-b border-borderHairline/30 last:border-b-0"
                style={{ borderBottomColor: `${colors.borderHairline}40` }}
                activeOpacity={0.8}
              >
                {/* Checkbox circle indicator */}
                <View 
                  className="w-4 h-4 rounded-full border items-center justify-center"
                  style={{ borderColor: isSelected ? colors.brandPrimary : colors.inkSecondary }}
                >
                  {isSelected && (
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.brandPrimary }} />
                  )}
                </View>

                {/* Theme label/description */}
                <View className="items-end">
                  <Text variant="body" className="font-uiMedium">
                    {opt.label}
                  </Text>
                  <Text variant="caption" className="opacity-70 mt-0.5">
                    {opt.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sign Out Button */}
        <Button
          label="خروج از حساب کاربری (Sign Out)"
          variant="secondary"
          onPress={signOut}
          className="mt-6 border-red-500/30"
          style={{ borderColor: `${colors.failed}30` }}
        />

      </ScrollView>
    </SafeAreaView>
  );
};
