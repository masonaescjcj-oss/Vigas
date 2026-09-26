/**
 * components/ui/Grille.tsx
 * ---------------------------------------------------------------------------
 * A round speaker grille — the dotted face of a Braun radio — drawn as dots.
 *
 * Built from Views rather than a CSS gradient because native has no gradient,
 * and only the dots that fall inside the circle are drawn, so nothing relies on
 * overflow clipping a rounded corner (which Android does unevenly).
 *
 * Decorative: hidden from screen readers.
 * ---------------------------------------------------------------------------
 */

import React, { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Led } from "./Led";

interface GrilleProps {
  size?: number;
  /** Distance between dot centres. */
  pitch?: number;
  dot?: number;
  color?: string;
  /** A lit indicator in the lower right, the way a radio shows it is on. */
  indicator?: boolean;
}

export const Grille: React.FC<GrilleProps> = ({ size = 88, pitch = 10, dot = 3, color, indicator = false }) => {
  const { colors } = useTheme();
  const fill = color ?? colors.surfaceStrong;

  const dots = useMemo(() => {
    const r = size / 2;
    const out: Array<{ x: number; y: number }> = [];
    for (let y = pitch / 2; y < size; y += pitch) {
      for (let x = pitch / 2; x < size; x += pitch) {
        const dx = x - r;
        const dy = y - r;
        if (dx * dx + dy * dy <= (r - dot) * (r - dot)) out.push({ x, y });
      }
    }
    return out;
  }, [size, pitch, dot]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: d.x - dot / 2,
            top: d.y - dot / 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: fill,
          }}
        />
      ))}
      {indicator ? (
        <Led size={Math.max(10, Math.round(size / 13))} style={{ position: "absolute", right: size * 0.1, bottom: size * 0.1 }} />
      ) : null}
    </View>
  );
};
