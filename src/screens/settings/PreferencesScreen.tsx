/**
 * frontend/src/screens/settings/PreferencesScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to edit general preferences: theme modes, languages, token savers,
 * default LLM engine settings, and haptic vibration triggers.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useSettingsStore } from "../../stores/settingsStore";

export const PreferencesScreen = () => {
  const { colors, mode, setMode } = useTheme();
  const navigation = useNavigation();

  // Settings Store values
  const {
    language,
    defaultModel,
    tokenSaver,
    hapticEnabled,
    soundEnabled,
    setLanguage,
    setDefaultModel,
    setTokenSaver,
    setHapticEnabled,
    setSoundEnabled,
  } = useSettingsStore();

  const handleLanguageChange = () => {
    setLanguage(language === "fa" ? "en" : "fa");
  };

  const handleModelChange = () => {
    const nextModel = defaultModel === "claude" ? "gpt-4o" : defaultModel === "gpt-4o" ? "deepseek" : "claude";
    setDefaultModel(nextModel);
  };

  const themeOptions: Array<{ key: typeof mode; label: string }> = [
    { key: "light", label: "Light Mode (Perplexity Beige)" },
    { key: "dark", label: "Dark Mode (Claude Khaki)" },
    { key: "darkest", label: "Darkest Mode (Grok Black)" },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-borderHairline/20" style={{ borderBottomColor: colors.borderHairline }}>
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Preferences</Text>
        </View>

        {/* Theme select section */}
        <View className="p-6">
          <Text variant="label" className="text-left mb-4">Application Theme</Text>
          {themeOptions.map((opt) => {
            const isSelected = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setMode(opt.key)}
                className="flex-row items-center justify-between p-4 bg-surfaceRaised rounded-card border mb-3"
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderColor: isSelected ? colors.brandPrimary : colors.borderHairline,
                  borderWidth: isSelected ? 2 : 1,
                }}
                activeOpacity={0.8}
              >
                <View 
                  className="w-4 h-4 rounded-full border items-center justify-center"
                  style={{ borderColor: isSelected ? colors.brandPrimary : colors.inkSecondary }}
                >
                  {isSelected && (
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.brandPrimary }} />
                  )}
                </View>
                <Text variant="body" className="font-uiMedium text-left">{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preferences rows */}
        <View className="mt-2">
          <Text variant="label" className="px-6 mb-2 text-left">General Settings</Text>
          
          <SettingsRow
            label="Application Language"
            value={language === "fa" ? "فارسی" : "English"}
            onPress={handleLanguageChange}
          />
          
          <SettingsRow
            label="Default AI Model"
            value={defaultModel === "claude" ? "Claude 3.5" : defaultModel === "gpt-4o" ? "GPT-4o" : "DeepSeek Coder"}
            onPress={handleModelChange}
          />

          <SettingsRow
            label="Token Saver Mode (Limit responses)"
            hasSwitch
            switchValue={tokenSaver}
            onSwitchChange={setTokenSaver}
          />

          <SettingsRow
            label="Haptic Feedback"
            hasSwitch
            switchValue={hapticEnabled}
            onSwitchChange={setHapticEnabled}
          />

          <SettingsRow
            label="In-App Notification Sound"
            hasSwitch
            switchValue={soundEnabled}
            onSwitchChange={setSoundEnabled}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
