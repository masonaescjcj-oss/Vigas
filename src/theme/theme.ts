/**
 * frontend/src/theme/theme.ts
 * ---------------------------------------------------------------------------
 * Design tokens.
 *
 * The palette is Perplexity's: a near-black paper ground, offwhite ink, and one
 * accent — True Turquoise — used sparingly. One accent is the whole point. The
 * screens previously hand-picked 70-odd colour pairs between them, which is why
 * nothing lined up; every surface, border and label now comes from here.
 *
 * Three modes: light (warm paper), dark (soft charcoal), darkest (near-black,
 * the default for the chat/code workspace).
 * ---------------------------------------------------------------------------
 */

export type ThemeMode = "light" | "dark" | "darkest";

export interface ColorTokens {
  /* Ground and surfaces, lightest use to heaviest. */
  canvasBase: string;
  surfaceRaised: string;
  /** Pills, chips, inset rows — a step up from the canvas. */
  surfaceMuted: string;
  /** Pressed or selected state of the above. */
  surfaceStrong: string;
  surfaceCode: string;

  /* Ink. */
  inkPrimary: string;
  inkSecondary: string;
  /** Placeholders and timestamps — present but recessive. */
  inkMuted: string;

  /* One accent, plus its tinted background. */
  brandPrimary: string;
  brandSoft: string;
  /** Kept for older screens that ask for a second accent by name. */
  accentTeal: string;

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
}

export const themeColors: Record<ThemeMode, ColorTokens> = {
  light: {
    canvasBase: "#FCFCF9",      // Paper white, very slightly warm
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#F2F2ED",
    surfaceStrong: "#E7E7E0",
    surfaceCode: "#F5F5F0",

    inkPrimary: "#13343B",      // Deep teal-ink, not pure black
    inkSecondary: "#5C7378",
    inkMuted: "#8A9BA0",

    brandPrimary: "#20808D",    // True Turquoise
    brandSoft: "rgba(32, 128, 141, 0.10)",
    accentTeal: "#20808D",

    bubbleUser: "#EDF3F4",

    borderHairline: "rgba(19, 52, 59, 0.10)",

    success: "#0F7B5F",
    successSoft: "rgba(15, 123, 95, 0.10)",
    failed: "#C0392B",
    failedSoft: "rgba(192, 57, 43, 0.10)",
    warning: "#A96A19",
    warningSoft: "rgba(169, 106, 25, 0.12)",
    running: "#20808D",

    incognito: "#6B4FA8",
    incognitoSoft: "rgba(107, 79, 168, 0.10)",
  },

  dark: {
    canvasBase: "#1B1C1C",
    surfaceRaised: "#232525",
    surfaceMuted: "#2A2C2C",
    surfaceStrong: "#343636",
    surfaceCode: "#151616",

    inkPrimary: "#F3F3EE",
    inkSecondary: "#A2A6A6",
    inkMuted: "#767A7A",

    brandPrimary: "#37B3C4",
    brandSoft: "rgba(55, 179, 196, 0.14)",
    accentTeal: "#37B3C4",

    bubbleUser: "#2C3435",

    borderHairline: "rgba(243, 243, 238, 0.09)",

    success: "#4CC38A",
    successSoft: "rgba(76, 195, 138, 0.14)",
    failed: "#F16A62",
    failedSoft: "rgba(241, 106, 98, 0.14)",
    warning: "#E0A458",
    warningSoft: "rgba(224, 164, 88, 0.14)",
    running: "#37B3C4",

    incognito: "#A78BFA",
    incognitoSoft: "rgba(167, 139, 250, 0.14)",
  },

  darkest: {
    canvasBase: "#0E0F0F",
    surfaceRaised: "#161818",
    surfaceMuted: "#1D1F1F",
    surfaceStrong: "#272A2A",
    surfaceCode: "#0A0B0B",

    inkPrimary: "#F3F3EE",
    inkSecondary: "#9BA0A0",
    inkMuted: "#6E7373",

    brandPrimary: "#3FC1D3",
    brandSoft: "rgba(63, 193, 211, 0.13)",
    accentTeal: "#3FC1D3",

    bubbleUser: "#23292A",

    borderHairline: "rgba(243, 243, 238, 0.07)",

    success: "#4CC38A",
    successSoft: "rgba(76, 195, 138, 0.13)",
    failed: "#F16A62",
    failedSoft: "rgba(241, 106, 98, 0.13)",
    warning: "#E0A458",
    warningSoft: "rgba(224, 164, 88, 0.13)",
    running: "#3FC1D3",

    incognito: "#A78BFA",
    incognitoSoft: "rgba(167, 139, 250, 0.13)",
  },
};

export const themeFonts = {
  ui: "Inter_500Medium",           // Grotesk clean UI font (Inter/System)
  uiRegular: "Inter_400Regular",
  uiMedium: "Inter_500Medium",
  uiSemiBold: "Inter_600SemiBold",
  editorial: "SourceSerifPro_400Regular", // Serif editorial response font
  editorialItalic: "SourceSerifPro_400Regular_Italic",
  editorialSemiBold: "SourceSerifPro_600SemiBold",
  mono: "JetBrainsMono_400Regular",      // Monospace code font
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
