/**
 * frontend/src/components/ToolCallCard.tsx
 * ---------------------------------------------------------------------------
 * Displays a tool call step with status indication and pulse animations:
 *   - running: teal status indicator with a smooth loop pulse animation
 *   - success: green indicator
 *   - failed: red indicator
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

export type ToolStatus = "running" | "success" | "failed";

interface ToolCallCardProps {
  toolName: string;
  status: ToolStatus;
  input?: string;
  output?: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  toolName,
  status,
  input,
  output,
}) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Set up pulsing animation loop for running status
  useEffect(() => {
    if (status === "running") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Determine colors based on status
  let badgeBg = "bg-opacity-10";
  let badgeText = "";
  let statusText = "";
  let indicatorColor = "";

  switch (status) {
    case "running":
      badgeBg = "bg-accentTeal/10";
      badgeText = "text-accentTeal";
      statusText = "Running";
      indicatorColor = colors.accentTeal;
      break;
    case "success":
      badgeBg = "bg-green-500/10";
      badgeText = "text-green-600";
      statusText = "Success";
      indicatorColor = colors.success;
      break;
    case "failed":
      badgeBg = "bg-red-500/10";
      badgeText = "text-red-600";
      statusText = "Failed";
      indicatorColor = colors.failed;
      break;
  }

  return (
    <View 
      className="bg-surfaceRaised p-4 rounded-card border border-borderHairline my-2 mx-4"
      style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          {/* Animated Status Indicator Dot */}
          <Animated.View
            className="w-2.5 h-2.5 rounded-full mr-2"
            style={{
              backgroundColor: indicatorColor,
              opacity: status === "running" ? pulseAnim : 1,
              transform: [
                {
                  scale: status === "running" ? pulseAnim.interpolate({
                    inputRange: [0.4, 1.0],
                    outputRange: [0.9, 1.1]
                  }) : 1
                }
              ]
            }}
          />
          <Text variant="h3" className="font-uiMedium">
            {toolName}
          </Text>
        </View>

        {/* Status Badge */}
        <View 
          className={`py-1 px-3 rounded-pill ${badgeBg}`}
          style={
            status === "running" 
              ? { backgroundColor: `${colors.accentTeal}1A` } 
              : status === "success"
                ? { backgroundColor: `${colors.success}1A` }
                : { backgroundColor: `${colors.failed}1A` }
          }
        >
          <Text 
            variant="caption" 
            className={`font-uiMedium ${badgeText}`}
            style={{ color: indicatorColor }}
          >
            {statusText}
          </Text>
        </View>
      </View>

      {/* Input arguments details */}
      {input && (
        <View className="mt-2 bg-surfaceCode p-2.5 rounded-input border border-borderHairline/30"
          style={{ backgroundColor: colors.surfaceCode }}>
          <Text variant="code" className="text-xs">
            {input}
          </Text>
        </View>
      )}

      {/* Output results details (if failed or has brief output) */}
      {output && status === "failed" && (
        <View className="mt-2 border-t border-borderHairline pt-2">
          <Text variant="caption" className="text-red-500 font-uiMedium" style={{ color: colors.failed }}>
            Error details:
          </Text>
          <Text variant="code" className="text-xs mt-1 text-red-500" style={{ color: colors.failed }}>
            {output}
          </Text>
        </View>
      )}
    </View>
  );
};
