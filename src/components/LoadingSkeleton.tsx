/**
 * frontend/src/components/LoadingSkeleton.tsx
 * ---------------------------------------------------------------------------
 * Loading Skeleton component with a smooth looping fade animation.
 * Supports different layout presets: chat, list, and file tree.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface LoadingSkeletonProps {
  variant?: "chat" | "list" | "tree";
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = "list",
  count = 3,
}) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  // Set up looping fade animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim]);

  const renderSkeletonRow = (idx: number) => {
    switch (variant) {
      case "chat":
        // Alternate bubbles between left and right
        const isLeft = idx % 2 === 0;
        return (
          <View 
            key={idx} 
            className={`flex-row my-3 px-4 ${isLeft ? "justify-start" : "justify-end"}`}
          >
            <Animated.View
              className="py-6 px-16 rounded-[20px]"
              style={{
                backgroundColor: colors.surfaceRaised,
                opacity: fadeAnim,
                width: isLeft ? "70%" : "60%",
              }}
            />
          </View>
        );

      case "tree":
        // Indented directory lines
        const indent = (idx % 3) * 16;
        return (
          <View 
            key={idx} 
            className="flex-row items-center py-3.5 px-4"
            style={{ paddingLeft: 16 + indent }}
          >
            {/* Folder icon placeholder */}
            <Animated.View
              className="w-4 h-4 rounded mr-3"
              style={{ backgroundColor: colors.surfaceRaised, opacity: fadeAnim }}
            />
            {/* File name placeholder */}
            <Animated.View
              className="h-3 rounded-full flex-1"
              style={{ backgroundColor: colors.surfaceRaised, opacity: fadeAnim }}
            />
          </View>
        );

      case "list":
      default:
        // Card lists (Project/Session cards)
        return (
          <View 
            key={idx} 
            className="p-5 rounded-card border mb-3 mx-4"
            style={{ 
              backgroundColor: colors.surfaceRaised, 
              borderColor: colors.borderHairline 
            }}
          >
            <Animated.View
              className="h-4 rounded-full w-2/5 mb-3 self-end"
              style={{ backgroundColor: colors.surfaceCode, opacity: fadeAnim }}
            />
            <Animated.View
              className="h-3 rounded-full w-4/5 self-end"
              style={{ backgroundColor: colors.surfaceCode, opacity: fadeAnim }}
            />
          </View>
        );
    }
  };

  return (
    <View className="w-full">
      {Array.from({ length: count }).map((_, idx) => renderSkeletonRow(idx))}
    </View>
  );
};
