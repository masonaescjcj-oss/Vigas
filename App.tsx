/**
 * frontend/App.tsx
 * ---------------------------------------------------------------------------
 * Main Expo App root component:
 *   - Sets up TanStack Query Client for client caching and synchronization.
 *   - Wraps the app in the custom ThemeProvider.
 *   - Mounts the AppNavigator for routing.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/services/queryClient";
import { NativeWindStyleSheet } from "nativewind";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { useAppFonts } from "./src/theme/useAppFonts";
import { themeColors } from "./src/theme/theme";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AlertHost } from "./src/components/AlertHost";
import "./global.css";

// Configure NativeWind output for web
NativeWindStyleSheet.setOutput({
  default: "native",
  web: "css",
});

export default function App() {
  // Render nothing until the typefaces resolve — a frame in the system font
  // followed by a reflow into Inter is worse than a moment of the app's own
  // background. `ready` also turns true on failure, so a font that fails to
  // load costs the right typeface, never the app.
  const { ready } = useAppFonts();
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: themeColors.darkest.canvasBase }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
          {/*
            Inside ThemeProvider because it is themed, and after the navigator
            so a dialog is never covered by a screen. Mounted once at the root:
            notify() is called from services that have no view of their own.
          */}
          <AlertHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
