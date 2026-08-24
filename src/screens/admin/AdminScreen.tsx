/**
 * frontend/src/screens/admin/AdminScreen.tsx
 * ---------------------------------------------------------------------------
 * The operator's panel.
 *
 * Reachable only when profiles.is_admin is set, which is done by hand in SQL —
 * there is no endpoint that grants it. Hiding the entry point is presentation,
 * not security: every action re-checks the flag server-side, so navigating
 * here directly gets a non-admin exactly nothing.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { selectionFeedback, tapFeedback } from "../../services/haptics";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminKeysTab } from "./AdminKeysTab";
import { AdminModelsTab } from "./AdminModelsTab";
import { AdminPlansTab } from "./AdminPlansTab";
import { AdminFunnelTab } from "./AdminFunnelTab";

const TABS = [
  { key: "keys", label: "Keys" },
  { key: "models", label: "Models" },
  { key: "plans", label: "Plans" },
  { key: "funnel", label: "Funnel" },
  { key: "overview", label: "Usage" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export const AdminScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  // Keys first: it is the tab you open when something is wrong.
  const [tab, setTab] = useState<TabKey>("keys");

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View
        className="flex-row items-center justify-between px-5 py-4 border-b"
        style={{ borderBottomColor: colors.borderHairline }}
      >
        <View className="w-16" />
        <Text variant="h3" className="font-uiSemiBold">Admin</Text>
        <TouchableOpacity
          onPress={() => { tapFeedback(); navigation.goBack(); }}
          className="p-2 w-16 items-end"
        >
          <Text variant="body" className="font-uiMedium">Done</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 pt-3">
        <View
          className="flex-row p-1 rounded-full border"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <TouchableOpacity
                key={entry.key}
                onPress={() => {
                  if (active) return;
                  selectionFeedback();
                  setTab(entry.key);
                }}
                className="flex-1 py-1.5 rounded-full items-center"
                style={{ backgroundColor: active ? colors.surfaceStrong : "transparent" }}
                activeOpacity={0.8}
              >
                <Text
                  variant="caption"
                  className="text-xs font-uiSemiBold"
                  style={{ color: active ? colors.inkPrimary : colors.inkSecondary }}
                >
                  {entry.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === "keys" ? <AdminKeysTab /> : null}
        {tab === "models" ? <AdminModelsTab /> : null}
        {tab === "plans" ? <AdminPlansTab /> : null}
        {tab === "overview" ? <AdminOverviewTab /> : null}
        {tab === "funnel" ? <AdminFunnelTab /> : null}
      </ScrollView>
    </SafeAreaView>
  );
};
