/**
 * frontend/src/components/PlanModeCard.tsx
 * ---------------------------------------------------------------------------
 * Card to show that the agent is in Plan Mode:
 *   - Pervasive 2px teal border.
 *   - Pale teal-tint background (5% opacity).
 *   - Displays structured, read-only plan steps.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

export interface PlanStepItem {
  id: string;
  type: string;
  description: string;
}

interface PlanModeCardProps {
  steps: PlanStepItem[];
  title?: string;
}

export const PlanModeCard: React.FC<PlanModeCardProps> = ({
  steps,
  title = "پلان پیشنهادی ایجنت (Proposed Plan)",
}) => {
  const { colors } = useTheme();

  // Create a 5% opacity version of accentTeal for the background
  const tealBg = `${colors.accentTeal}0D`; // 0D in hex corresponds to 5% opacity (roughly 13/255)

  return (
    <View 
      className="p-5 my-3 mx-4 rounded-card border-2"
      style={{ 
        borderColor: colors.accentTeal, 
        backgroundColor: tealBg 
      }}
    >
      {/* Header */}
      <View className="mb-3 border-b pb-2" style={{ borderColor: `${colors.accentTeal}20` }}>
        <Text variant="h3" className="font-uiSemiBold text-accentTeal" style={{ color: colors.accentTeal }}>
          {title}
        </Text>
        <Text variant="caption" className="text-inkSecondary mt-0.5">
          حالت برنامه‌ریزی (Plan Mode) • تغییر غیرمجاز است
        </Text>
      </View>

      {/* Steps List */}
      <View className="space-y-3">
        {steps.map((step, index) => (
          <View key={step.id} className="flex-row items-start py-1">
            {/* Step Number Dot */}
            <View 
              className="w-5 h-5 rounded-full items-center justify-center mr-3 mt-0.5"
              style={{ backgroundColor: `${colors.accentTeal}20` }}
            >
              <Text 
                variant="caption" 
                className="font-uiMedium text-accentTeal text-[10px]"
                style={{ color: colors.accentTeal }}
              >
                {index + 1}
              </Text>
            </View>

            {/* Step Content */}
            <View className="flex-1">
              <Text variant="body" className="font-uiMedium text-inkPrimary text-xs uppercase tracking-wide opacity-80">
                {step.type.replace("_", " ")}
              </Text>
              <Text variant="body" className="text-inkPrimary mt-0.5">
                {step.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};
