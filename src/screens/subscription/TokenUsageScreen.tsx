/**
 * frontend/src/screens/subscription/TokenUsageScreen.tsx
 * ---------------------------------------------------------------------------
 * Detailed Token Usage Screen.
 * Renders daily consumption using UsageChart.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { UsageChart } from "../../components/UsageChart";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";

export const TokenUsageScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile } = useAuthStore();

  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokensLimit, setTokensLimit] = useState(100000);
  const [loading, setLoading] = useState(false);

  // Simulated daily data points for UsageChart
  const mockUsageData = [
    { dayLabel: "Jul 24", value: 1200 },
    { dayLabel: "Jul 25", value: 3400 },
    { dayLabel: "Jul 26", value: 4500 },
    { dayLabel: "Jul 27", value: 2100 },
    { dayLabel: "Jul 28", value: 8900 },
    { dayLabel: "Jul 29", value: 6500 },
    { dayLabel: "Jul 30", value: 11000 },
  ];

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("usage_metering")
          .select("tokens_used, plan_limit_tokens")
          .maybeSingle();

        if (!error && data) {
          setTokensUsed(data.tokens_used);
          setTokensLimit(data.plan_limit_tokens);
        } else {
          // Mock display if table empty
          setTokensUsed(36500);
          setTokensLimit(100000);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void fetchUsage();
  }, []);

  const usagePercent = Math.min((tokensUsed / tokensLimit) * 100, 100);
  const isCloseToLimit = usagePercent >= 75;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Token Usage</Text>
          <View className="w-10" />
        </View>

        {/* Total Summary */}
        <View 
          className="bg-surfaceRaised p-5 rounded-card border border-borderHairline mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-left">Total Tokens Used</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.brandPrimary} className="mt-4" />
          ) : (
            <View className="mt-3">
              <Text variant="h2" className="font-uiSemiBold text-left">
                {tokensUsed.toLocaleString()} / {tokensLimit.toLocaleString()} tokens
              </Text>
              
              {/* Progress bar container */}
              <View className="h-2.5 w-full bg-surfaceCode rounded-full mt-4 overflow-hidden" style={{ backgroundColor: colors.surfaceCode }}>
                <View 
                   className="h-full bg-brandPrimary rounded-full"
                   style={{ 
                     backgroundColor: isCloseToLimit ? colors.failed : colors.brandPrimary,
                     width: `${usagePercent}%` 
                   }}
                />
              </View>
              
              {isCloseToLimit && (
                <Text variant="caption" className="text-red-500 text-left mt-3 font-uiMedium" style={{ color: colors.failed }}>
                  ⚠️ You have used more than 75% of your token limit.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 2. Usage chart component */}
        <UsageChart data={mockUsageData} maxVal={12000} />

        {/* 3. Upgrade callout */}
        {isCloseToLimit && (
          <View 
            className="p-5 rounded-card border-2 mt-6 items-start"
            style={{ borderColor: colors.brandPrimary, backgroundColor: `${colors.brandPrimary}08` }}
          >
            <Text variant="h3" className="font-uiSemiBold text-brandPrimary" style={{ color: colors.brandPrimary }}>
              Increase Token Limit
            </Text>
            <Text variant="caption" className="text-left mt-1.5 opacity-90 leading-5">
              By upgrading to Pro, increase your monthly token limit to 2 million and double your build speed.
            </Text>
            <Button
              label="View Packages"
              onPress={() => navigation.navigate("Paywall" as any)}
              className="mt-4 w-full"
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};
