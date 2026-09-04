/**
 * components/ui/Pill.tsx
 * ---------------------------------------------------------------------------
 * A small status word: Active, Failed, Default.
 *
 * Soft tint behind the tone's own colour, so it labels without competing with
 * the row it sits in. `solid` is for the one case where a pill has to be read
 * at a glance from across the screen.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";

export type PillTone = "success" | "warning" | "failed" | "brand" | "muted";

export const Pill: React.FC<{ tone?: PillTone; solid?: boolean; children: React.ReactNode }> = ({
  tone = "muted",
  solid = false,
  children,
}) => {
  const { colors } = useTheme();
  const map = {
    success: { soft: colors.successSoft, fg: colors.success },
    warning: { soft: colors.warningSoft, fg: colors.warning },
    failed: { soft: colors.failedSoft, fg: colors.failed },
    brand: { soft: colors.brandSoft, fg: colors.brandPrimary },
    muted: { soft: colors.surfaceMuted, fg: colors.inkSecondary },
  }[tone];

  return (
    <View
      className="rounded-pill"
      style={{ backgroundColor: solid ? map.fg : map.soft, paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text
        variant="caption"
        className="text-[11px] font-uiMedium"
        style={{ color: solid ? colors.canvasBase : map.fg }}
      >
        {children}
      </Text>
    </View>
  );
};
