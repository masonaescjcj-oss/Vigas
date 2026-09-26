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
 * Three bodies: Platinum (light), Graphite, and Black — the default, and the
 * one the chat and code surfaces were designed on.
 * ---------------------------------------------------------------------------
 */

export type ThemeMode = "light" | "dark" | "darkest";

/** What each mode is called where a person picks one. */
export const THEME_LABEL: Record<ThemeMode, string> = {
  light: "Platinum",
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
  // Platinum: the grey plastic of a Braun calculator. The signal is a burnt
  // orange here — the bright one fails contrast as text on a light body.
  light: {
    canvasBase: "#EFEBE4",
    surfaceRaised: "#F9F7F3",
    surfaceMuted: "#E5E0D7",
    surfaceStrong: "#D8D1C5",
    surfaceCode: "#E4DFD5",

    inkPrimary: "#1D1B18",
    inkSecondary: "#56504A",
    inkMuted: "#6B655C",

    brandPrimary: "#B8440C",
    brandSoft: "rgba(184, 68, 12, 0.10)",
    brandEdge: "#7F2F08",
    accentTeal: "#B8440C",
    capEdge: "rgba(29, 27, 24, 0.16)",

    bubbleUser: "#E5E0D7",

    borderHairline: "rgba(29, 27, 24, 0.10)",

    success: "#2F7A3A",
    successSoft: "rgba(47, 122, 58, 0.10)",
    failed: "#B8392E",
    failedSoft: "rgba(184, 57, 46, 0.10)",
    warning: "#8A6A00",
    warningSoft: "rgba(138, 106, 0, 0.12)",
    running: "#B8440C",

    incognito: "#6B4FA8",
    incognitoSoft: "rgba(107, 79, 168, 0.10)",

    scrim: "rgba(29, 27, 24, 0.40)",
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
