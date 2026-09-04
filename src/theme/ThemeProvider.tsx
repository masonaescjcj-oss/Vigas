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

  // Follow the system theme only until the user picks one. Before this, the
  // listener overrode a saved choice on every launch and on every OS theme
  // change — someone who chose dark got light back the next morning, with no
  // way to make it stick. A choice, once made, is theirs.
  useEffect(() => {
    if (useThemeStore.getState().chosen) return;

    const follow = (scheme: string | null | undefined) => {
      // Re-read at event time: the user may have chosen since we subscribed.
      if (useThemeStore.getState().chosen) return;
      if (scheme === "light") useThemeStore.setState({ mode: "light" });
      else if (scheme === "dark") useThemeStore.setState({ mode: "darkest" });
    };

    follow(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme }) => follow(colorScheme));
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
    "--surfaceMuted": colors.surfaceMuted,
    "--surfaceStrong": colors.surfaceStrong,
    "--inkPrimary": colors.inkPrimary,
    "--inkSecondary": colors.inkSecondary,
    "--inkMuted": colors.inkMuted,
    "--brandPrimary": colors.brandPrimary,
    "--brandSoft": colors.brandSoft,
    "--accentTeal": colors.accentTeal,
    "--bubbleUser": colors.bubbleUser,
    "--borderHairline": colors.borderHairline,
    "--success": colors.success,
    "--successSoft": colors.successSoft,
    "--failed": colors.failed,
    "--failedSoft": colors.failedSoft,
    "--warning": colors.warning,
    "--warningSoft": colors.warningSoft,
    "--running": colors.running,
    "--incognito": colors.incognito,
    "--incognitoSoft": colors.incognitoSoft,
    "--scrim": colors.scrim,
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
