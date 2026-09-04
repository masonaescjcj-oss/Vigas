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
        accentTeal: "var(--accentTeal)",
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
      // These must be the names useFonts registers, not the marketing names.
      // "Inter" was never a loaded family, so every one of these classes
      // silently fell back to the platform's default face.
      fontFamily: {
        ui: ["Inter_500Medium", "System", "sans-serif"],
        uiRegular: ["Inter_400Regular", "System", "sans-serif"],
        uiMedium: ["Inter_500Medium", "System", "sans-serif"],
        uiSemiBold: ["Inter_600SemiBold", "System", "sans-serif"],
        uiBold: ["Inter_700Bold", "System", "sans-serif"],
        // Persian and Arabic. Components pick this per string (theme/fonts.ts);
        // the classes exist for the few places that know their own script.
        fa: ["Vazirmatn_400Regular", "System", "sans-serif"],
        faMedium: ["Vazirmatn_500Medium", "System", "sans-serif"],
        faSemiBold: ["Vazirmatn_600SemiBold", "System", "sans-serif"],
        faBold: ["Vazirmatn_700Bold", "System", "sans-serif"],
        sans: ["Inter_400Regular", "System", "sans-serif"],
        mono: ["JetBrainsMono_400Regular", "Courier New", "monospace"],
        monoMedium: ["JetBrainsMono_500Medium", "Courier New", "monospace"],
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
        card: "16px",
        input: "12px",
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
