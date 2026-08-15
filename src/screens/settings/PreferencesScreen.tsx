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
import { useSettingsStore, type ModelPreference } from "../../stores/settingsStore";

export const PreferencesScreen = () => {
  const { colors, mode, setMode } = useTheme();
  const navigation = useNavigation();

  const { defaultModel, setDefaultModel } = useSettingsStore();

  // Must stay in sync with the agent-run allow-list (ALLOWED_MODELS).
  const modelOptions: Array<{ key: ModelPreference; label: string }> = [
    { key: "auto", label: "Auto (server default)" },
    { key: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { key: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { key: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ];

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

        {/* Default model — remembered across launches and pre-selected in chat */}
        <View className="px-6 pb-6">
          <Text variant="label" className="text-left mb-4">Default AI Model</Text>
          {modelOptions.map((opt) => {
            const isSelected = defaultModel === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setDefaultModel(opt.key)}
                className="flex-row items-center justify-between p-4 rounded-card border mb-3"
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

      </ScrollView>
    </SafeAreaView>
  );
};
