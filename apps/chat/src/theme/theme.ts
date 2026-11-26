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
    canvasBase: "#F6F4F0",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#F1EEE9",
    surfaceStrong: "#E6E1D9",
    surfaceCode: "#121214",

    inkPrimary: "#111113",
    inkSecondary: "#4B4A52",
    inkMuted: "#7E7D86",

    brandPrimary: "#E04712",
    brandSoft: "rgba(224, 71, 18, 0.10)",
    brandEdge: "#B5360B",
    accentTeal: "#E04712",
    capEdge: "rgba(17, 17, 19, 0.10)",

    bubbleUser: "#EFECE6",

    borderHairline: "rgba(17, 17, 19, 0.08)",

    success: "#0F8A56",
    successSoft: "rgba(15, 138, 86, 0.10)",
    failed: "#CC2F49",
    failedSoft: "rgba(204, 47, 73, 0.10)",
    warning: "#9C6D11",
    warningSoft: "rgba(156, 109, 17, 0.10)",
    running: "#E04712",

    incognito: "#5855D6",
    incognitoSoft: "rgba(88, 85, 214, 0.10)",

    scrim: "rgba(17, 17, 19, 0.36)",
  },

  dark: {
    canvasBase: "#101012",
    surfaceRaised: "#18181B",
    surfaceMuted: "#222226",
    surfaceStrong: "#2C2C32",
    surfaceCode: "#070708",

    inkPrimary: "#F5F3EF",
    inkSecondary: "#A6A5AB",
    inkMuted: "#6F6E76",

    brandPrimary: "#FF5A1F",
    brandSoft: "rgba(255, 90, 31, 0.14)",
    brandEdge: "#C43E10",
    accentTeal: "#FF5A1F",
    capEdge: "rgba(0, 0, 0, 0.45)",

    bubbleUser: "#1B1B1E",

    borderHairline: "rgba(255, 255, 255, 0.08)",

    success: "#3EE39B",
    successSoft: "rgba(62, 227, 155, 0.14)",
    failed: "#FF6B81",
    failedSoft: "rgba(255, 107, 129, 0.14)",
    warning: "#E3B65C",
    warningSoft: "rgba(227, 182, 92, 0.14)",
    running: "#FF5A1F",

    incognito: "#8F8CFF",
    incognitoSoft: "rgba(143, 140, 255, 0.14)",

    scrim: "rgba(6, 6, 7, 0.72)",
  },

  // Obsidian Signal 2026 default: Deep Obsidian #0A0A0B with Signal Orange #FF5A1F
  darkest: {
    canvasBase: "#0A0A0B",
    surfaceRaised: "#141416",
    surfaceMuted: "#1B1B1E",
    surfaceStrong: "#26262A",
    surfaceCode: "#070708",

    inkPrimary: "#F5F3EF",
    inkSecondary: "#A6A5AB",
    inkMuted: "#6F6E76",

    brandPrimary: "#FF5A1F",
    brandSoft: "rgba(255, 90, 31, 0.14)",
    brandEdge: "#C43E10",
    accentTeal: "#FF5A1F",
    capEdge: "rgba(0, 0, 0, 0.50)",

    bubbleUser: "#1B1B1E",

    borderHairline: "rgba(255, 255, 255, 0.07)",

    success: "#3EE39B",
    successSoft: "rgba(62, 227, 155, 0.14)",
    failed: "#FF6B81",
    failedSoft: "rgba(255, 107, 129, 0.14)",
    warning: "#E3B65C",
    warningSoft: "rgba(227, 182, 92, 0.14)",
    running: "#FF5A1F",

    incognito: "#8F8CFF",
    incognitoSoft: "rgba(143, 140, 255, 0.14)",

    scrim: "rgba(5, 5, 6, 0.76)",
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
