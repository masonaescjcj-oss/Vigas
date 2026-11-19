/**
 * components/ui/Monogram.tsx
 * ---------------------------------------------------------------------------
 * The account's initial on a key.
 *
 * Not an avatar: nobody uploads a photo here, and an empty silhouette in a
 * circle is a picture of a feature that does not exist. One letter in the
 * signal colour says whose account it is.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { keyEdge } from "../../theme/device";

export const Monogram: React.FC<{ name?: string | null; size?: number }> = ({ name, size = 40 }) => {
  const { colors } = useTheme();
  const letter = (name ?? "").trim().charAt(0).toUpperCase() || "·";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        keyEdge(colors.capEdge),
      ]}
    >
      <Text variant="h1" style={{ fontSize: Math.round(size * 0.46), lineHeight: Math.round(size * 0.56), color: colors.brandPrimary, letterSpacing: 0 }}>
        {letter}
      </Text>
    </View>
  );
};
