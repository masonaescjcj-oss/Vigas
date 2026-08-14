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
      fontFamily: {
        ui: ["Inter", "System", "sans-serif"],
        uiRegular: ["Inter", "System", "sans-serif"],
        uiMedium: ["Inter", "System", "sans-serif"],
        uiSemiBold: ["Inter", "System", "sans-serif"],
        editorial: ["Source Serif 4", "Georgia", "serif"],
        editorialItalic: ["Source Serif 4", "Georgia", "serif"],
        editorialSemiBold: ["Source Serif 4", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
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
