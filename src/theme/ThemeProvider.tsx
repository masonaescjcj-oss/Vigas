/**
 * frontend/src/theme/ThemeProvider.tsx
 * ---------------------------------------------------------------------------
 * Context provider and custom hook to expose theme tokens to React components
 * and manage NativeWind/Tailwind color-scheme states.
 * ---------------------------------------------------------------------------
 */

import React, { createContext, useContext, useEffect } from "react";
import { View, StatusBar, Appearance } from "react-native";
import { useThemeStore } from "./store";
import { themeColors, themeFonts, themeSpacing, themeTransitions, type ThemeMode, type ColorTokens } from "./theme";

interface ThemeContextType {
  mode: ThemeMode;
  colors: ColorTokens;
  fonts: typeof themeFonts;
  spacing: typeof themeSpacing;
  transitions: typeof themeTransitions;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode, setMode } = useThemeStore();
  const colors = themeColors[mode];

  // Auto-detect system light/dark mode on startup & listen for OS theme changes
  useEffect(() => {
    const systemScheme = Appearance.getColorScheme();
    if (systemScheme === "light") {
      setMode("light");
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme === "light") {
        setMode("light");
      } else if (colorScheme === "dark") {
        setMode("darkest");
      }
    });

    return () => subscription.remove();
  }, []);

  // Set the Status Bar style dynamically based on theme mode for a premium feel
  useEffect(() => {
    if (mode === "light") {
      StatusBar.setBarStyle("dark-content");
    } else {
      StatusBar.setBarStyle("light-content");
    }
  }, [mode]);

  const themeStyles = {
    "--canvasBase": colors.canvasBase,
    "--surfaceRaised": colors.surfaceRaised,
    "--surfaceCode": colors.surfaceCode,
    "--inkPrimary": colors.inkPrimary,
    "--inkSecondary": colors.inkSecondary,
    "--brandPrimary": colors.brandPrimary,
    "--accentTeal": colors.accentTeal,
    "--borderHairline": colors.borderHairline,
    "--success": colors.success,
    "--failed": colors.failed,
    "--running": colors.running,
  };

  const value: ThemeContextType = {
    mode,
    colors,
    fonts: themeFonts,
    spacing: themeSpacing,
    transitions: themeTransitions,
    setMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {/* 
        The root container injects the background color and applies 
        a CSS class matching the active theme mode for NativeWind styling.
      */}
      <View 
        style={[{ flex: 1, backgroundColor: colors.canvasBase }, themeStyles as any]}
        className={`theme-${mode} ${mode === "light" ? "light" : "dark"}`}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
