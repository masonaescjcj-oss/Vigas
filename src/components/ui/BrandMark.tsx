/**
 * components/ui/BrandMark.tsx
 * ---------------------------------------------------------------------------
 * The RetroAI logo: two tape reels joined by the tape, the left hub lit in
 * the signal colour.
 *
 * Drawn in a 100-unit box: reels centred at (29, 50) and (71, 50), radius 17
 * to the middle of a 6.5-wide ring, the tape along their bottoms at y = 67.
 * scripts/make-brand-assets.py draws the icon from the same numbers, so the
 * icon and the mark in the app are one drawing — keep the two in step.
 *
 * Built from Views (rings are bordered circles), like the rest of the
 * instrument parts, so it renders the same on native and web without SVG.
 *
 * Decorative: hidden from screen readers (the screens name the app in text).
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

const RING = 17;
const STROKE = 6.5;
const REELS = [29, 71];
const CENTRE_Y = 50;
const TAPE_Y = 67;

interface BrandMarkProps {
  size?: number;
  /** Reels and tape. */
  ink?: string;
  /** The lit hub. */
  accent?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 96, ink, accent }) => {
  const { colors } = useTheme();
  const inkColor = ink ?? colors.inkPrimary;
  const accentColor = accent ?? colors.brandPrimary;
  const u = size / 100;

  const circle = (cx: number, cy: number, radius: number, style: ViewStyle): ViewStyle => ({
    position: "absolute",
    left: (cx - radius) * u,
    top: (cy - radius) * u,
    width: radius * 2 * u,
    height: radius * 2 * u,
    borderRadius: radius * u,
    ...style,
  });

  const outer = RING + STROKE / 2;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      {REELS.map((cx) => (
        <View key={cx} style={circle(cx, CENTRE_Y, outer, { borderWidth: STROKE * u, borderColor: inkColor })} />
      ))}
      {/* The tape, round-ended, along the bottoms of both reels. */}
      <View
        style={{
          position: "absolute",
          left: (REELS[0] - STROKE / 2) * u,
          top: (TAPE_Y - STROKE / 2) * u,
          width: (REELS[1] - REELS[0] + STROKE) * u,
          height: STROKE * u,
          borderRadius: (STROKE / 2) * u,
          backgroundColor: inkColor,
        }}
      />
      <View style={circle(REELS[0], CENTRE_Y, 6.2, { backgroundColor: accentColor })} />
      <View style={circle(REELS[1], CENTRE_Y, 3.4, { backgroundColor: inkColor })} />
    </View>
  );
};
