/**
 * frontend/src/screens/settings/SecuritySettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Security Settings Screen:
 *   - Sign out everywhere.
 *   - Explains why a connected-devices list is not shown: listing or revoking
 *     other sessions needs Supabase's admin session APIs, which are
 *     service-role only. Biometrics and 2FA are not implemented.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";

export const SecuritySettingsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { signOut } = useAuthStore();

  const handleSignOutEverywhere = async () => {
    try {
      await signOut();
    } catch (e: any) {
      notify("Could not sign out", e?.message ?? "Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-borderHairline/20" style={{ borderBottomColor: colors.borderHairline }}>
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Security Settings</Text>
        </View>

        <View className="px-6 py-6">
          <Text variant="label" className="text-left mb-3">Password</Text>
          <Text variant="caption" className="text-left opacity-80 leading-5 mb-4">
            Change your password from Account settings. Signing out here ends this
            device's session only.
          </Text>

          <Text variant="label" className="text-left mb-3 mt-4">Sessions</Text>
          <Text variant="caption" className="text-left opacity-80 leading-5">
            Listing or revoking sessions on other devices needs a server-side admin
            API that this build does not expose yet, so no device list is shown —
            an invented one would be worse than none.
          </Text>

          <TouchableOpacity
            onPress={handleSignOutEverywhere}
            className="mt-6 py-3 px-4 rounded-card border items-center"
            style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
          >
            <Text variant="body" className="font-uiMedium" style={{ color: colors.failed }}>
              Sign out on this device
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
