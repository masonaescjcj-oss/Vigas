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
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/services/queryClient";
import { NativeWindStyleSheet } from "nativewind";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import { AppNavigator } from "./src/navigation/AppNavigator";
import "./global.css";

// Configure NativeWind output for web
NativeWindStyleSheet.setOutput({
  default: "native",
  web: "css",
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
