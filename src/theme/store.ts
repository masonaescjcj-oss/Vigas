/**
 * frontend/src/theme/store.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage theme selection state dynamically without refresh.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";
import { type ThemeMode } from "./theme";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "darkest", // Darkest mode is the default for Chat/Code editor per design spec
  setMode: (mode) => set({ mode }),
}));
