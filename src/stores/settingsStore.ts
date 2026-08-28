/**
 * frontend/src/stores/settingsStore.ts
 * ---------------------------------------------------------------------------
 * User preferences. Persisted to AsyncStorage — previously every setting was
 * in-memory only, so anything the user changed was silently lost on reload.
 *
 * Only settings that actually do something live here. Options with no
 * implementation behind them (sound effects, token saver, biometrics, 2FA)
 * were removed rather than kept as switches that lie.
 * ---------------------------------------------------------------------------
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ModelPreference = "auto" | "gpt-5.6-terra";

interface SettingsState {
  /** Model pre-selected in the chat composer. */
  defaultModel: ModelPreference;
  /** True once the user has been through (or skipped) onboarding. */
  hasSeenOnboarding: boolean;

  setDefaultModel: (model: ModelPreference) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultModel: "auto",
      hasSeenOnboarding: false,
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),
    }),
    {
      name: "retro-code-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
