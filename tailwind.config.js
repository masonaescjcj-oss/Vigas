/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvasBase: "var(--canvasBase)",
        surfaceRaised: "var(--surfaceRaised)",
        surfaceCode: "var(--surfaceCode)",
        inkPrimary: "var(--inkPrimary)",
        inkSecondary: "var(--inkSecondary)",
        brandPrimary: "var(--brandPrimary)",
        accentTeal: "var(--accentTeal)",
        borderHairline: "var(--borderHairline)",
        success: "var(--success)",
        failed: "var(--failed)",
        running: "var(--running)",
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
        // No serif is loaded, so these resolve to the UI face rather than to
        // nothing. Kept as names so existing markup keeps working.
        editorial: ["Inter_400Regular", "System", "sans-serif"],
        editorialItalic: ["Inter_400Regular", "System", "sans-serif"],
        editorialSemiBold: ["Inter_600SemiBold", "System", "sans-serif"],
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
      },
      transitionDuration: {
        theme: "200ms",
      },
    },
  },
  plugins: [],
};
