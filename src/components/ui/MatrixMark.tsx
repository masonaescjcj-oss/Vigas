/**
 * components/ui/MatrixMark.tsx
 * ---------------------------------------------------------------------------
 * The Retro Code logo: "r." set in the dots of a round speaker grille.
 *
 * A 9×9 grid of dots, only those inside the circle drawn. Most are dim — the
 * grille at rest — and eleven are lit: nine spell a lowercase r, one is the
 * period in the signal colour. The same geometry is drawn by
 * scripts/make-brand-assets.py for the app icon, so the icon and the mark in
 * the app are one drawing.
 *
 * Built from Views, like the rest of the instrument parts, so it renders the
 * same on native and web without an SVG layer.
 *
 * Decorative: hidden from screen readers (the screens name the app in text).
 * ---------------------------------------------------------------------------
 */

import React, { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

/** Grid cells [column, row] that spell the r, on a 9×9 grid. */
const R_CELLS = new Set(["2,2", "4,2", "5,2", "2,3", "3,3", "6,3", "2,4", "2,5", "2,6"]);
const PERIOD_CELL = "6,6";

interface MatrixMarkProps {
  size?: number;
  /** The grille's resting dots. */
  dim?: string;
  /** The dots that spell the r. */
  ink?: string;
  /** The period. */
  accent?: string;
}

export const MatrixMark: React.FC<MatrixMarkProps> = ({ size = 96, dim, ink, accent }) => {
  const { colors } = useTheme();
  const dimColor = dim ?? colors.surfaceStrong;
  const inkColor = ink ?? colors.inkPrimary;
  const accentColor = accent ?? colors.brandPrimary;

  const dots = useMemo(() => {
    const unit = size / 100;
    const out: Array<{ x: number; y: number; d: number; kind: "dim" | "ink" | "accent" }> = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const x = 10 + col * 10;
        const y = 10 + row * 10;
        if (Math.hypot(x - 50, y - 50) > 42.5) continue;
        const key = `${col},${row}`;
        const kind = key === PERIOD_CELL ? "accent" : R_CELLS.has(key) ? "ink" : "dim";
        const radius = kind === "accent" ? 4 : kind === "ink" ? 3.7 : 3;
        out.push({ x: x * unit, y: y * unit, d: radius * 2 * unit, kind });
      }
    }
    return out;
  }, [size]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      {dots.map((dot, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: dot.x - dot.d / 2,
            top: dot.y - dot.d / 2,
            width: dot.d,
            height: dot.d,
            borderRadius: dot.d / 2,
            backgroundColor: dot.kind === "accent" ? accentColor : dot.kind === "ink" ? inkColor : dimColor,
          }}
        />
      ))}
    </View>
  );
};
