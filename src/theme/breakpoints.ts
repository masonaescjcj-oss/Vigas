/**
 * frontend/src/theme/breakpoints.ts
 * ---------------------------------------------------------------------------
 * How wide the window is, as a decision rather than a number.
 *
 * The app was designed for a phone and, on the web, rendered as a phone
 * layout stretched across a desktop browser: a 1400px-wide chat bubble, a
 * composer the width of the monitor, a settings form whose fields ran edge to
 * edge. Two thresholds fix nearly all of it:
 *
 *   compact   a phone — the layout every screen was built for
 *   wide      a desktop browser or a landscape tablet: content sits in a
 *             centred column, and the chat gets its drawer as a sidebar
 *
 * `useWindowDimensions` re-renders on resize, so dragging a browser window
 * across the threshold re-lays the screen out live.
 * ---------------------------------------------------------------------------
 */

import { useWindowDimensions, type ViewStyle } from "react-native";

/** Below this the app is a phone; at or above it, a desktop. */
export const WIDE_MIN = 960;

/** The widest a reading column gets. Roughly 80 characters of body text. */
export const COLUMN_MAX = 760;

/** Settings, forms, lists: narrower than prose, so rows do not sprawl. */
export const FORM_MAX = 640;

/** The chat sidebar on a wide screen. */
export const SIDEBAR_WIDTH = 300;

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  return { width, height, wide, compact: !wide };
}

/**
 * A centred column on wide screens; the full width on a phone.
 *
 * Used as a stack navigator's `contentStyle`, so every screen in that stack is
 * constrained at once and no screen has to know the breakpoint exists.
 */
export function columnStyle(wide: boolean, max: number = FORM_MAX): ViewStyle {
  return wide ? { width: "100%", maxWidth: max, alignSelf: "center" } : {};
}
