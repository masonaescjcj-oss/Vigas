/**
 * frontend/src/components/PlanCard.tsx
 * ---------------------------------------------------------------------------
 * One plan, selectable.
 *
 * The card put its radio dot hard left and then right-aligned the name and the
 * price against it, so the eye crossed the card to read two words. Name and
 * price lead; the saving sits at the trailing edge; the tick marks the choice.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { Pill } from "./ui/Pill";
import { useTheme } from "../theme/ThemeProvider";
import { selectionFeedback } from "../services/haptics";

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
      onPress={() => { selectionFeedback(); onSelect(); }}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      activeOpacity={0.7}
      className="p-4 rounded-card mb-2.5 flex-row items-center"
      style={{
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: isSelected ? colors.brandPrimary : colors.borderHairline,
      }}
    >
      <View className="flex-1 mr-3">
        <Text variant="body" className="font-uiMedium">{title}</Text>
        <Text variant="caption" className="mt-0.5" style={{ color: colors.inkSecondary }}>
          {price} / {period === "monthly" ? "month" : "year"}
        </Text>
      </View>

      {savings ? <Pill tone="success">{savings}</Pill> : null}
      {isSelected ? (
        <Icon name="check" size={18} color={colors.brandPrimary} style={{ marginLeft: 10 }} />
      ) : null}
    </TouchableOpacity>
  );
};
