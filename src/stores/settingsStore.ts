/**
 * frontend/src/stores/settingsStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage user preferences, app language, haptic feedbacks,
 * and security toggles.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";

interface SettingsState {
  language: "fa" | "en";
  defaultModel: "claude" | "gpt-4o" | "deepseek";
  tokenSaver: boolean;
  hapticEnabled: boolean;
  soundEnabled: boolean;
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
  
  setLanguage: (lang: "fa" | "en") => void;
  setDefaultModel: (model: "claude" | "gpt-4o" | "deepseek") => void;
  setTokenSaver: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setTwoFactorEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "fa",
  defaultModel: "claude",
  tokenSaver: false,
  hapticEnabled: true,
  soundEnabled: true,
  biometricEnabled: false,
  twoFactorEnabled: false,

  setLanguage: (language) => set({ language }),
  setDefaultModel: (defaultModel) => set({ defaultModel }),
  setTokenSaver: (tokenSaver) => set({ tokenSaver }),
  setHapticEnabled: (hapticEnabled) => set({ hapticEnabled }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
  setTwoFactorEnabled: (twoFactorEnabled) => set({ twoFactorEnabled }),
}));
