/**
 * frontend/src/components/PlanCard.tsx
 * ---------------------------------------------------------------------------
 * Selectable card for Subscription Paywalls.
 * Highlights defaults, savings, and key details.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface PlanCardProps {
  title: string;
  price: string;
  period: string;
  savings?: string;
  isSelected: boolean;
  onSelect: () => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  title,
  price,
  period,
  savings,
  isSelected,
  onSelect,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.8}
      className="p-5 rounded-card border mb-4 flex-row justify-between items-center"
      style={{
        backgroundColor: colors.surfaceRaised,
        borderColor: isSelected ? colors.brandPrimary : colors.borderHairline,
        borderWidth: isSelected ? 2 : 1,
      }}
    >
      {/* 1. Left Selection dot */}
      <View 
        className="w-5 h-5 rounded-full border items-center justify-center"
        style={{ borderColor: isSelected ? colors.brandPrimary : colors.inkSecondary }}
      >
        {isSelected && (
          <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.brandPrimary }} />
        )}
      </View>

      {/* 2. Details Column */}
      <View className="flex-1 items-end pr-4">
        {savings && (
          <View 
            className="py-0.5 px-2 rounded-pill mb-1.5"
            style={{ backgroundColor: `${colors.brandPrimary}20` }}
          >
            <Text variant="caption" className="font-uiMedium text-[9px]" style={{ color: colors.brandPrimary }}>
              {savings}
            </Text>
          </View>
        )}
        <Text variant="body" className="font-uiSemiBold text-right">
          {title}
        </Text>
        <Text variant="caption" className="opacity-75 mt-0.5">
          {price} / {period === "monthly" ? "month" : "year"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
