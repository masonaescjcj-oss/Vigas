/**
 * frontend/src/screens/subscription/TokenUsageScreen.tsx
 * ---------------------------------------------------------------------------
 * Detailed Token Usage Screen.
 * Renders daily consumption using UsageChart.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { UsageChart } from "../../components/UsageChart";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";

export const TokenUsageScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useAuthStore();

  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokensLimit, setTokensLimit] = useState(100000);
  const [loading, setLoading] = useState(false);

  // Real per-period history from usage_metering (one row per period).
  const [usageHistory, setUsageHistory] = useState<Array<{ dayLabel: string; value: number }>>([]);

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("usage_metering")
          .select("tokens_used, plan_limit_tokens, period_start")
          .order("period_start", { ascending: false })
          .limit(7);

        if (error) throw error;
        const rows = data ?? [];
        if (rows.length > 0) {
          setTokensUsed(rows[0].tokens_used ?? 0);
          setTokensLimit(rows[0].plan_limit_tokens ?? 0);
          setUsageHistory(
            [...rows].reverse().map((row) => ({
              dayLabel: new Date(row.period_start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              value: row.tokens_used ?? 0,
            })),
          );
        } else {
          setTokensUsed(0);
          setTokensLimit(0);
          setUsageHistory([]);
        }
      } catch (e: any) {
        notify("Could not load usage", e?.message ?? "Please try again.");
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

        {/* 2. Usage chart — real per-period history */}
        {usageHistory.length > 0 ? (
          <UsageChart
            data={usageHistory}
            maxVal={Math.max(1, ...usageHistory.map((point) => point.value))}
          />
        ) : (
          <View className="py-8 items-center">
            <Text variant="caption" className="opacity-70">No usage history yet.</Text>
          </View>
        )}

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
              onPress={() => navigation.navigate("Paywall", {})}
              className="mt-4 w-full"
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};
