/**
 * frontend/src/theme/theme.ts
 * ---------------------------------------------------------------------------
 * Design tokens.
 *
 * The app is drawn as an instrument — the calculators and radios Dieter Rams'
 * team made for Braun, and the terminals the name "retro" points at. A warm
 * graphite body instead of black, keys that stand up from it, wells that sink
 * into it, and one signal colour — orange, the "=" key — used where something
 * is live, chosen, or the one thing to press.
 *
 * Three bodies: White (light), Graphite, and Black — the default, and the
 * one the chat and code surfaces were designed on.
 * ---------------------------------------------------------------------------
 */

export type ThemeMode = "light" | "dark" | "darkest";

/** What each mode is called where a person picks one. */
export const THEME_LABEL: Record<ThemeMode, string> = {
  light: "White",
  dark: "Graphite",
  darkest: "Black",
};

export interface ColorTokens {
  /* Body and surfaces, from the body up. */
  canvasBase: string;
  /** A key or a card: stands up from the body. */
  surfaceRaised: string;
  /** Keys on a card, chips, the selected half of a switch. */
  surfaceMuted: string;
  /** Pressed, or a key's darker neighbour. */
  surfaceStrong: string;
  /** A well: inputs, code, the track of a switch — sunk into the body. */
  surfaceCode: string;

  /* Ink. */
  inkPrimary: string;
  inkSecondary: string;
  /** Labels, timestamps, placeholders — present but recessive. */
  inkMuted: string;

  /* The signal colour, its tint, and the darker lip under a signal key. */
  brandPrimary: string;
  brandSoft: string;
  brandEdge: string;
  /** Kept for older screens that ask for a second accent by name. */
  accentTeal: string;
  /** The shadowed bottom edge that makes a surface read as a key. */
  capEdge: string;

  /** The user's own message. */
  bubbleUser: string;

  borderHairline: string;

  /* Status. Each has a tint for use behind its own text. */
  success: string;
  successSoft: string;
  failed: string;
  failedSoft: string;
  warning: string;
  warningSoft: string;
  running: string;

  /** Incognito's own hue, so it reads as a different mode at a glance. */
  incognito: string;
  incognitoSoft: string;

  /** Behind a sheet or dialog. */
  scrim: string;
}

export const themeColors: Record<ThemeMode, ColorTokens> = {
  // White: a white body, the way Braun's white radios were white — not a
  // cream, which read as dirty next to a phone's own white UI. On a white body
  // nothing can stand up by being lighter, so keys and cards are a soft grey
  // with a hairline, and wells sink by a shade and an inner shadow. The greys
  // keep a trace of warmth so the orange still belongs to them. The signal is
  // the darkest orange that is still orange: white text on it passes 4.5:1,
  // and so does it as text on white.
  light: {
    canvasBase: "#FFFFFF",
    surfaceRaised: "#F6F5F4",
    surfaceMuted: "#EEEDEB",
    surfaceStrong: "#E4E2DF",
    surfaceCode: "#F3F2F0",

    inkPrimary: "#1C1A18",
    inkSecondary: "#57534E",
    inkMuted: "#736D66",

    brandPrimary: "#C94A0E",
    brandSoft: "rgba(201, 74, 14, 0.09)",
    brandEdge: "#8F3309",
    accentTeal: "#C94A0E",
    capEdge: "rgba(28, 26, 24, 0.12)",

    bubbleUser: "#F1F0EE",

    borderHairline: "rgba(28, 26, 24, 0.09)",

    success: "#2F7A3A",
    successSoft: "rgba(47, 122, 58, 0.09)",
    failed: "#B8392E",
    failedSoft: "rgba(184, 57, 46, 0.09)",
    warning: "#8A6A00",
    warningSoft: "rgba(138, 106, 0, 0.10)",
    running: "#C94A0E",

    incognito: "#6B4FA8",
    incognitoSoft: "rgba(107, 79, 168, 0.09)",

    scrim: "rgba(28, 26, 24, 0.32)",
  },

  // Graphite: a step lighter than Black, for people who find near-black hard.
  dark: {
    canvasBase: "#221F1C",
    surfaceRaised: "#2D2A26",
    surfaceMuted: "#38342F",
    surfaceStrong: "#45403A",
    surfaceCode: "#181614",

    inkPrimary: "#F1ECE3",
    inkSecondary: "#B0A99E",
    inkMuted: "#9D968B",

    brandPrimary: "#FF7A2E",
    brandSoft: "rgba(255, 122, 46, 0.15)",
    brandEdge: "#B3561F",
    accentTeal: "#FF7A2E",
    capEdge: "rgba(0, 0, 0, 0.40)",

    bubbleUser: "#38342F",

    borderHairline: "rgba(241, 236, 227, 0.09)",

    success: "#86CB84",
    successSoft: "rgba(134, 203, 132, 0.15)",
    failed: "#F38A82",
    failedSoft: "rgba(243, 138, 130, 0.15)",
    warning: "#EACB4A",
    warningSoft: "rgba(234, 203, 74, 0.15)",
    running: "#FF7A2E",

    incognito: "#BBA6F3",
    incognitoSoft: "rgba(187, 166, 243, 0.15)",

    scrim: "rgba(10, 9, 8, 0.62)",
  },

  // Black: the default. Warm graphite rather than #000, so the keys and wells
  // have something to stand up from and sink into.
  darkest: {
    canvasBase: "#171614",
    surfaceRaised: "#24221F",
    surfaceMuted: "#2E2B27",
    surfaceStrong: "#3A3631",
    surfaceCode: "#0F0E0D",

    inkPrimary: "#EFEAE1",
    inkSecondary: "#A8A197",
    inkMuted: "#948D82",

    brandPrimary: "#FF6A1A",
    brandSoft: "rgba(255, 106, 26, 0.14)",
    brandEdge: "#B24A12",
    accentTeal: "#FF6A1A",
    capEdge: "rgba(0, 0, 0, 0.45)",

    bubbleUser: "#2E2B27",

    borderHairline: "rgba(239, 234, 225, 0.08)",

    success: "#7CC47A",
    successSoft: "rgba(124, 196, 122, 0.14)",
    failed: "#F07A72",
    failedSoft: "rgba(240, 122, 114, 0.14)",
    warning: "#E6C229",
    warningSoft: "rgba(230, 194, 41, 0.14)",
    running: "#FF6A1A",

    incognito: "#B39DF0",
    incognitoSoft: "rgba(179, 157, 240, 0.14)",

    scrim: "rgba(8, 7, 6, 0.68)",
  },
};

/**
 * The families the app loads — see theme/fonts.ts for why each and
 * theme/useAppFonts.ts for the loading. Persian and Arabic are not in this
 * list on purpose: they keep the device's own face.
 */
export const themeFonts = {
  ui: "IBMPlexSans_500Medium",
  uiRegular: "IBMPlexSans_400Regular",
  uiMedium: "IBMPlexSans_500Medium",
  uiSemiBold: "IBMPlexSans_600SemiBold",
  uiBold: "IBMPlexSans_600SemiBold",
  display: "BricolageGrotesque_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
};

export const themeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
};

export const themeTransitions = {
  duration: 200,
  easing: "ease-out",
};
