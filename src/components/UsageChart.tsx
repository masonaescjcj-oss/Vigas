/**
 * frontend/src/components/UsageChart.tsx
 * ---------------------------------------------------------------------------
 * Renders token usage stats using a beautiful bar-chart layout.
 * Pure React Native Views styled as bars to avoid heavy external dependencies.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, Dimensions } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface ChartDataPoint {
  dayLabel: string;
  value: number;
}

interface UsageChartProps {
  data: ChartDataPoint[];
  maxVal?: number;
}

export const UsageChart: React.FC<UsageChartProps> = ({ data, maxVal = 10000 }) => {
  const { colors } = useTheme();

  // Find dynamic max limit
  const values = data.map((d) => d.value);
  const highestValue = Math.max(...values, maxVal);

  return (
    <View 
      className="p-4 bg-surfaceRaised rounded-card border border-borderHairline items-center"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
    >
      <Text variant="label" className="mb-4 text-right self-end">نمودار مصرف روزانه (توکن)</Text>

      {/* Chart Bars Wrapper */}
      <View className="h-40 w-full flex-row items-end justify-between px-2 pt-6">
        {data.map((dp, idx) => {
          // Calculate height percentage
          const percentHeight = Math.min((dp.value / highestValue) * 100, 100);
          
          return (
            <View key={idx} className="items-center flex-1 mx-1 justify-end h-full">
              {/* Tooltip value */}
              <Text variant="caption" className="text-[8px] opacity-75 mb-1 text-center">
                {dp.value >= 1000 ? `${(dp.value / 1000).toFixed(1)}k` : dp.value}
              </Text>
              
              {/* Bar Column */}
              <View 
                className="w-full rounded-t-sm"
                style={{ 
                  height: `${percentHeight}%`, 
                  backgroundColor: colors.brandPrimary 
                }}
              />
              
              {/* Label */}
              <Text variant="caption" className="text-[8px] mt-2 opacity-60 text-center">
                {dp.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};
