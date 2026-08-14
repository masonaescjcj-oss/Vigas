/**
 * frontend/src/theme/theme.ts
 * ---------------------------------------------------------------------------
 * Design system tokens inspired by:
 *   - Perplexity: Warm paper feel, dual typography (Grotesk + Serif editorial)
 *   - Claude: Warm/earthy minimalism
 *   - Grok: High-contrast Darkest mode (#0A0A0A / black) with neon orange brand accent
 * ---------------------------------------------------------------------------
 */

export type ThemeMode = "light" | "dark" | "darkest";

export interface ColorTokens {
  canvasBase: string;
  surfaceRaised: string;
  surfaceCode: string;
  inkPrimary: string;
  inkSecondary: string;
  brandPrimary: string;
  accentTeal: string;
  borderHairline: string;
  success: string;
  failed: string;
  running: string;
}

export const themeColors: Record<ThemeMode, ColorTokens> = {
  light: {
    canvasBase: "#FFFFFF",      // Pure 100% Crisp White background
    surfaceRaised: "#FFFFFF",   // Pure White floating cards
    surfaceCode: "#F8FAFC",     // Soft pristine light surface
    inkPrimary: "#0F172A",      // Dark Slate Charcoal text
    inkSecondary: "#475569",    // Slate gray secondary text
    brandPrimary: "#6D42C7",    // Deep Purple accent
    accentTeal: "#38BDF8",      // Sky blue accent
    borderHairline: "rgba(15, 23, 42, 0.08)",
    success: "#10B981",
    failed: "#EF4444",
    running: "#6D42C7",
  },
  dark: {
    canvasBase: "#171615",      // Earthy charcoal
    surfaceRaised: "#1E1D1C",
    surfaceCode: "#11100F",
    inkPrimary: "#D6D5D4",
    inkSecondary: "#91908F",
    brandPrimary: "#D97757",
    accentTeal: "#4E99A3",
    borderHairline: "rgba(214,213,212,0.1)",
    success: "#4CAF50",
    failed: "#EF5350",
    running: "#4E99A3",
  },
  darkest: {
    canvasBase: "#0A0A0A",      // Grok deepest pitch black
    surfaceRaised: "#141414",
    surfaceCode: "#000000",     // Pure black coding space
    inkPrimary: "#F5F5F0",
    inkSecondary: "#9E9E99",
    brandPrimary: "#FF6B35",    // Vibrant Grok orange
    accentTeal: "#4E99A3",
    borderHairline: "rgba(255,255,255,0.06)",
    success: "#66BB6A",
    failed: "#FF5252",
    running: "#4E99A3",
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
