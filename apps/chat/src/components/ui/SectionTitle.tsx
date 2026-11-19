/**
 * components/ui/SectionTitle.tsx
 * ---------------------------------------------------------------------------
 * The legend over a group of rows or fields: small mono lowercase, the way a
 * panel labels its controls. It orients; it does not announce.
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
        <Text variant="caption" className="mt-1" style={{ color: colors.inkMuted, lineHeight: 18 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};
