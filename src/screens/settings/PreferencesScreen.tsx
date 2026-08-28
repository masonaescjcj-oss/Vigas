/**
 * frontend/src/screens/settings/PreferencesScreen.tsx
 * ---------------------------------------------------------------------------
 * Screen to edit general preferences: theme mode, the default model, and
 * whether the app may come and find you when a build finishes.
 *
 * Notifications register themselves silently on sign-in, which means a user who
 * declined the permission would otherwise never learn why nothing arrives. This
 * screen is where that state is stated plainly and can be changed on purpose.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Linking, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useSettingsStore, type ModelPreference } from "../../stores/settingsStore";
import { registerForPush, type PushStatus } from "../../services/pushService";
import { tapFeedback } from "../../services/haptics";

/**
 * What each outcome means for the person reading it, and whether there is
 * anything they can do. "denied" is a setting they control; "not_configured" is
 * ours to fix and should not be dressed up as their problem.
 */
const PUSH_COPY: Record<PushStatus, { title: string; detail: string; action: "retry" | "settings" | null }> = {
  registered: {
    title: "On for this device",
    detail: "You will be told when a build finishes, even with the app closed.",
    action: null,
  },
  denied: {
    title: "Turned off",
    detail: "Notifications are blocked for Retro Code in your system settings.",
    action: "settings",
  },
  unsupported: {
    title: "Not available here",
    detail: "Build notifications work in the mobile app on a real device.",
    action: null,
  },
  not_configured: {
    title: "Not available in this build",
    detail: "This build cannot be issued a push token yet. Nothing you need to do.",
    action: null,
  },
  not_migrated: {
    title: "Not set up on the server yet",
    detail: "The notifications table has not been created yet.",
    action: "retry",
  },
  failed: {
    title: "Could not turn on",
    detail: "Something went wrong registering this device.",
    action: "retry",
  },
};

export const PreferencesScreen = () => {
  const { colors, mode, setMode } = useTheme();
  const navigation = useNavigation();

  const { defaultModel, setDefaultModel } = useSettingsStore();

  // Null while unknown. Read by asking, not from a stored flag: the user can
  // change the system permission outside the app at any time, and a remembered
  // "on" would then be a lie.
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushDetail, setPushDetail] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const checkPush = async () => {
    setPushBusy(true);
    try {
      const result = await registerForPush();
      setPushStatus(result.status);
      setPushDetail(result.detail ?? null);
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => { void checkPush(); }, []);

  // Must stay in sync with the agent-run allow-list (ALLOWED_MODELS).
  const modelOptions: Array<{ key: ModelPreference; label: string }> = [
    { key: "auto", label: "Auto (server default)" },
    { key: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
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

        {/* Build notifications — real state, asked fresh each time */}
        <View className="px-6 pb-6">
          <Text variant="label" className="text-left mb-4">Build Notifications</Text>
          <View
            className="p-4 rounded-card border"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          >
            {pushBusy && pushStatus === null ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <>
                <View className="flex-row items-center">
                  <View
                    className="w-2 h-2 rounded-full mr-2.5"
                    style={{
                      backgroundColor: pushStatus === "registered" ? colors.success : colors.inkMuted,
                    }}
                  />
                  <Text variant="body" className="font-uiMedium text-left flex-1">
                    {PUSH_COPY[pushStatus ?? "failed"].title}
                  </Text>
                </View>
                <Text variant="caption" className="text-left mt-2 leading-5" style={{ color: colors.inkSecondary }}>
                  {PUSH_COPY[pushStatus ?? "failed"].detail}
                </Text>
                {/* The underlying message, when there is one worth showing. */}
                {pushDetail && pushStatus !== "registered" && pushStatus !== "unsupported" ? (
                  <Text variant="caption" className="text-left mt-1 text-[11px]" style={{ color: colors.inkMuted }}>
                    {pushDetail}
                  </Text>
                ) : null}

                {PUSH_COPY[pushStatus ?? "failed"].action === "settings" ? (
                  <TouchableOpacity
                    onPress={() => { tapFeedback(); void Linking.openSettings(); }}
                    className="mt-3 self-start px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: colors.surfaceMuted }}
                  >
                    <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.brandPrimary }}>
                      {Platform.OS === "ios" ? "Open iOS Settings" : "Open app settings"}
                    </Text>
                  </TouchableOpacity>
                ) : PUSH_COPY[pushStatus ?? "failed"].action === "retry" ? (
                  <TouchableOpacity
                    onPress={() => { tapFeedback(); void checkPush(); }}
                    disabled={pushBusy}
                    className="mt-3 self-start px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: colors.surfaceMuted }}
                  >
                    {pushBusy ? (
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                    ) : (
                      <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.brandPrimary }}>
                        Try again
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
