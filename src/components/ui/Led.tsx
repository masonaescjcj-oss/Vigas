/**
 * components/ui/Led.tsx
 * ---------------------------------------------------------------------------
 * An indicator light: which mode is on, which model is chosen, which chat you
 * are in, whether the preview is live.
 *
 * Lit is the signal colour with a glow; unlit is a dark dot in the same place,
 * so a row of options keeps its alignment whichever one is on.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { glow } from "../../theme/device";

interface LedProps {
  on?: boolean;
  /** Defaults to the signal colour. Status uses success / failed. */
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export const Led: React.FC<LedProps> = ({ on = true, color, size = 7, style }) => {
  const { colors } = useTheme();
  const lit = color ?? colors.brandPrimary;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: on ? lit : colors.surfaceStrong },
        on ? glow(lit, size + 1) : null,
        style,
      ]}
    />
  );
};
