/**
 * frontend/src/screens/settings/PreferencesScreen.tsx
 * ---------------------------------------------------------------------------
 * Theme, default model, and whether the app may come and find you when a
 * build finishes.
 *
 * Choices are rows in a group with a check on the chosen one — the way every
 * phone's own settings do it — instead of three separate cards each with a
 * radio dot and a two-pixel brand border when selected. The theme names lose
 * their parentheses: "Light Mode (Perplexity Beige)" was a note to the
 * designer, not to the user.
 *
 * Notifications register themselves silently on sign-in, which means a user who
 * declined the permission would otherwise never learn why nothing arrives. This
 * screen is where that state is stated plainly and can be changed on purpose.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Linking, Platform } from "react-native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useSettingsStore, type ModelPreference } from "../../stores/settingsStore";
import { registerForPush, type PushStatus } from "../../services/pushService";
import { selectionFeedback } from "../../services/haptics";

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

/** One choice in a group. The check is the only mark of selection. */
const OptionRow = ({
  label,
  hint,
  selected,
  last,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  last?: boolean;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => { selectionFeedback(); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.6}
      className="flex-row items-center px-4"
      style={{ minHeight: 52, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderHairline }}
    >
      <View className="flex-1 py-3">
        <Text variant="body">{label}</Text>
        {hint ? <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>{hint}</Text> : null}
      </View>
      {selected ? <Icon name="check" size={18} color={colors.brandPrimary} /> : null}
    </TouchableOpacity>
  );
};

export const PreferencesScreen = () => {
  const { colors, mode, setMode } = useTheme();
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
  const modelOptions: Array<{ key: ModelPreference; label: string; hint?: string }> = [
    { key: "auto", label: "Automatic", hint: "The server picks the current default" },
    { key: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
  ];

  const themeOptions: Array<{ key: typeof mode; label: string }> = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "darkest", label: "Black" },
  ];

  const push = PUSH_COPY[pushStatus ?? "failed"];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Preferences" divider={false} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <SectionTitle first>Appearance</SectionTitle>
        <Card flush>
          {themeOptions.map((opt, i) => (
            <OptionRow
              key={opt.key}
              label={opt.label}
              selected={mode === opt.key}
              last={i === themeOptions.length - 1}
              onPress={() => setMode(opt.key)}
            />
          ))}
        </Card>

        <SectionTitle hint="Pre-selected in every new chat. You can still change it per message.">Default model</SectionTitle>
        <Card flush>
          {modelOptions.map((opt, i) => (
            <OptionRow
              key={opt.key}
              label={opt.label}
              hint={opt.hint}
              selected={defaultModel === opt.key}
              last={i === modelOptions.length - 1}
              onPress={() => setDefaultModel(opt.key)}
            />
          ))}
        </Card>

        <SectionTitle>Build notifications</SectionTitle>
        <Card>
          {pushBusy && pushStatus === null ? (
            <ActivityIndicator size="small" color={colors.inkMuted} />
          ) : (
            <>
              <View className="flex-row items-center">
                <View
                  className="w-2 h-2 rounded-full mr-2.5"
                  style={{ backgroundColor: pushStatus === "registered" ? colors.success : colors.inkMuted }}
                />
                <Text variant="body" className="font-uiMedium flex-1">{push.title}</Text>
              </View>
              <Text variant="caption" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 18 }}>
                {push.detail}
              </Text>
              {/* The underlying message, when there is one worth showing. */}
              {pushDetail && pushStatus !== "registered" && pushStatus !== "unsupported" ? (
                <Text variant="caption" className="mt-1" style={{ color: colors.inkMuted }}>{pushDetail}</Text>
              ) : null}

              {push.action === "settings" ? (
                <Button
                  label={Platform.OS === "ios" ? "Open iOS Settings" : "Open app settings"}
                  tone="neutral"
                  size="sm"
                  className="mt-3"
                  onPress={() => void Linking.openSettings()}
                />
              ) : push.action === "retry" ? (
                <Button label="Try again" tone="neutral" size="sm" className="mt-3" loading={pushBusy} onPress={() => void checkPush()} />
              ) : null}
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
