/**
 * frontend/src/theme/device.ts
 * ---------------------------------------------------------------------------
 * The physical vocabulary: what makes a surface read as a key, a well, a lit
 * indicator, a strip of printer paper or a calculator display.
 *
 *   key    a raised surface with a darker lip along its bottom edge. A bottom
 *          border rather than a shadow, because React Native on Android draws
 *          no inset shadow and a border looks the same on every platform.
 *   well   sunk into the body. The web gets an inset shadow on top of the
 *          darker fill; native gets the fill alone, which still reads.
 *   glow   a lit LED. Web and iOS can blur a coloured shadow; Android cannot
 *          colour one, so there the dot is simply lit.
 *
 * The tape and the display keep their own colours in every theme. Paper is
 * paper and an LCD is an LCD; neither changes colour when the room does.
 * ---------------------------------------------------------------------------
 */

import { Platform, type ViewStyle } from "react-native";
import type { ThemeMode } from "./theme";

/** The run log's printer paper. */
export const TAPE = {
  paper: "#EFE8D8",
  ink: "#2A2620",
  muted: "#6B6356",
  rule: "#C9BFA9",
  ok: "#2F6B34",
  fail: "#9E2A20",
  failSoft: "rgba(158, 42, 32, 0.08)",
} as const;

/** The verification code's segment display. */
export const LCD = {
  body: "#1B1E17",
  ink: "#CBD8A6",
  ghost: "#262B20",
  legend: "#8C977A",
} as const;

/** The lip along a key's bottom edge. */
export function keyEdge(edge: string, width = 2): ViewStyle {
  return { borderBottomWidth: width, borderBottomColor: edge };
}

/** A surface sunk into the body. */
export function wellShadow(mode: ThemeMode): ViewStyle {
  if (Platform.OS !== "web") return {};
  const shadow =
    mode === "light"
      ? "inset 0 1px 3px rgba(29, 27, 24, 0.18), inset 0 -1px 0 rgba(255, 255, 255, 0.6)"
      : "inset 0 2px 4px rgba(0, 0, 0, 0.55), inset 0 -1px 0 rgba(255, 255, 255, 0.04)";
  return { boxShadow: shadow } as ViewStyle;
}

/** A lit indicator. */
export function glow(color: string, radius = 8): ViewStyle {
  if (Platform.OS === "web") return { boxShadow: `0 0 ${radius}px ${color}` } as ViewStyle;
  if (Platform.OS === "ios") {
    return { shadowColor: color, shadowOpacity: 0.9, shadowRadius: radius / 2, shadowOffset: { width: 0, height: 0 } };
  }
  return {};
}
