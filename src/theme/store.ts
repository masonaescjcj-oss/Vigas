/**
 * frontend/src/theme/store.ts
 * ---------------------------------------------------------------------------
 * Which theme is on, remembered.
 *
 * It was not remembered. The store reset to "darkest" on every launch, and the
 * Appearance listener in ThemeProvider then flipped it to light on any device
 * whose system theme was light — so a person who chose dark got light back the
 * next morning, and had no way to make it stick. Persisted now, so a choice is
 * a choice.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ThemeMode } from "./theme";

interface ThemeState {
  mode: ThemeMode;
  /** True once the user has picked; the system-theme listener then leaves it alone. */
  chosen: boolean;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Darkest is the default: the chat and code surfaces were designed on it.
      mode: "darkest",
      chosen: false,
      setMode: (mode) => set({ mode, chosen: true }),
    }),
    {
      name: "retro-code.theme",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
