/**
 * components/ui/Gauge.tsx
 * ---------------------------------------------------------------------------
 * A half-dial: how much of a limit is used.
 *
 * Drawn to one scale — the arc is the limit, the lit part is what has been
 * used — with the count itself in the middle, so the reading never depends on
 * judging an angle. The needle colour turns to warning once the window is
 * nearly full, and the figure says so in words underneath.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";

interface GaugeProps {
  used: number;
  /** Null is unlimited: the dial is drawn empty and the figure says so. */
  limit: number | null;
  label: string;
  /** One line under the label: when it resets, or that it is full. */
  detail?: string;
}

const W = 140;
const H = 80;
const R = 60;
/** Half the circumference of the arc: the full length a dash can cover. */
const ARC = Math.PI * R;

export const Gauge: React.FC<GaugeProps> = ({ used, limit, label, detail }) => {
  const { colors } = useTheme();
  const fraction = limit && limit > 0 ? Math.min(1, used / limit) : 0;
  const nearlyFull = limit !== null && limit > 0 && fraction >= 0.75;
  const arc = `M ${W / 2 - R} ${H - 8} A ${R} ${R} 0 0 1 ${W / 2 + R} ${H - 8}`;

  return (
    <View
      accessible
      accessibilityLabel={limit === null ? `${label}: ${used}, no limit` : `${label}: ${used} of ${limit}`}
      style={{ alignItems: "center" }}
    >
      <Svg width={W} height={H}>
        <Path d={arc} fill="none" stroke={colors.surfaceCode} strokeWidth={10} strokeLinecap="round" />
        {fraction > 0 ? (
          <Path
            d={arc}
            fill="none"
            stroke={nearlyFull ? colors.warning : colors.brandPrimary}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${(fraction * ARC).toFixed(1)} ${ARC.toFixed(1)}`}
          />
        ) : null}
      </Svg>
      <View style={{ marginTop: -38, flexDirection: "row", alignItems: "baseline" }}>
        <Text variant="h1" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{String(used)}</Text>
        <Text variant="label" style={{ marginLeft: 4 }}>{limit === null ? "no limit" : `/ ${limit}`}</Text>
      </View>
      <Text variant="body" className="font-uiMedium" style={{ fontSize: 14, marginTop: 6 }}>{label}</Text>
      {detail ? (
        <Text variant="label" style={{ fontSize: 11, textTransform: "none", marginTop: 1, color: nearlyFull ? colors.warning : colors.inkMuted }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
};
