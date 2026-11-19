/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // One entry per ColorTokens key, and a test that keeps it that way.
      // Eleven of these were missing, so no class could reach surfaceMuted,
      // inkMuted, warning or any of the soft tints — and 76 places across the
      // screens reached for purple-950, slate-200 and red-500 instead.
      colors: {
        canvasBase: "var(--canvasBase)",
        surfaceRaised: "var(--surfaceRaised)",
        surfaceMuted: "var(--surfaceMuted)",
        surfaceStrong: "var(--surfaceStrong)",
        surfaceCode: "var(--surfaceCode)",
        inkPrimary: "var(--inkPrimary)",
        inkSecondary: "var(--inkSecondary)",
        inkMuted: "var(--inkMuted)",
        brandPrimary: "var(--brandPrimary)",
        brandSoft: "var(--brandSoft)",
        brandEdge: "var(--brandEdge)",
        accentTeal: "var(--accentTeal)",
        capEdge: "var(--capEdge)",
        bubbleUser: "var(--bubbleUser)",
        borderHairline: "var(--borderHairline)",
        success: "var(--success)",
        successSoft: "var(--successSoft)",
        failed: "var(--failed)",
        failedSoft: "var(--failedSoft)",
        warning: "var(--warning)",
        warningSoft: "var(--warningSoft)",
        running: "var(--running)",
        incognito: "var(--incognito)",
        incognitoSoft: "var(--incognitoSoft)",
        scrim: "var(--scrim)",
      },
      // The names theme/useAppFonts registers. Typography picks the family
      // per weight at render time; these classes are for the raw Text the few
      // components that bypass it still render.
      fontFamily: {
        ui: ["IBMPlexSans_500Medium", "System", "sans-serif"],
        uiRegular: ["IBMPlexSans_400Regular", "System", "sans-serif"],
        uiMedium: ["IBMPlexSans_500Medium", "System", "sans-serif"],
        uiSemiBold: ["IBMPlexSans_600SemiBold", "System", "sans-serif"],
        uiBold: ["IBMPlexSans_600SemiBold", "System", "sans-serif"],
        display: ["BricolageGrotesque_600SemiBold", "System", "sans-serif"],
        sans: ["IBMPlexSans_400Regular", "System", "sans-serif"],
        mono: ["IBMPlexMono_400Regular", "Menlo", "monospace"],
        monoMedium: ["IBMPlexMono_500Medium", "Menlo", "monospace"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        xxl: "32px",
        xxxl: "48px",
        huge: "64px",
      },
      borderRadius: {
        pill: "9999px",
        card: "18px",
        input: "14px",
        // Bottom sheets only: the one place a larger radius earns its keep.
        sheet: "24px",
      },
      transitionDuration: {
        theme: "200ms",
      },
    },
  },
  plugins: [],
};
