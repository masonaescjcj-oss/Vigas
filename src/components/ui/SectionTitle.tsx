/**
 * components/ui/SectionTitle.tsx
 * ---------------------------------------------------------------------------
 * The heading over a group of rows or fields.
 *
 * Small and dim, sitting above its group with room beneath. Seventeen screens
 * set this in uppercase with letter-spacing, which made every settings page
 * read as a form from an office. A heading orients; it does not announce.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";

export const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string; first?: boolean }> = ({
  children,
  hint,
  first = false,
}) => {
  const { colors } = useTheme();
  return (
    <View className={`${first ? "mt-2" : "mt-7"} mb-2 px-1`}>
      <Text variant="label">{children}</Text>
      {hint ? (
        <Text variant="caption" className="mt-1 leading-5" style={{ color: colors.inkMuted }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};
