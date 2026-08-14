/**
 * frontend/src/screens/settings/SecuritySettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Security Settings Screen:
 *   - Biometric login (Face ID/Fingerprint) toggle.
 *   - Active sessions list (Connected devices) with individual disconnects.
 *   - Two-Factor authentication toggle.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useSettingsStore } from "../../stores/settingsStore";

interface DeviceSession {
  id: string;
  name: string;
  location: string;
  lastActive: string;
}

export const SecuritySettingsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const {
    biometricEnabled,
    twoFactorEnabled,
    setBiometricEnabled,
    setTwoFactorEnabled,
  } = useSettingsStore();

  // Listing other devices requires Supabase admin session APIs (service-role);
  // the client can only see its own session, so this list stays empty instead of
  // inventing devices and locations.
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  const handleDisconnectSession = (id: string, name: string) => {
    Alert.alert(
      "Disconnect Session",
      `Are you sure you want to end the session for "${name}"? The device will be logged out.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Disconnect", 
          style: "destructive",
          onPress: () => {
            setSessions(sessions.filter((s) => s.id !== id));
            notify("Success", "Device has been successfully signed out.");
          }
        }
      ]
    );
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

        {/* Security options toggles */}
        <View className="mt-4">
          <SettingsRow
            label="Biometric Login (Face ID / Fingerprint)"
            hasSwitch
            switchValue={biometricEnabled}
            onSwitchChange={setBiometricEnabled}
          />
          
          <SettingsRow
            label="Two-Factor Authentication (2FA)"
            hasSwitch
            switchValue={twoFactorEnabled}
            onSwitchChange={setTwoFactorEnabled}
          />
        </View>

        {/* Active sessions list */}
        <View className="mt-8 px-6">
          <Text variant="label" className="text-left mb-4">Connected Devices / Active Sessions</Text>
          
          {sessions.map((item) => (
            <View 
              key={item.id}
              className="bg-surfaceRaised p-4 rounded-card border border-borderHairline mb-3 flex-row justify-between items-center"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
            >
              {/* Terminate button */}
              <TouchableOpacity
                onPress={() => handleDisconnectSession(item.id, item.name)}
                className="py-1.5 px-3 bg-red-500/10 rounded border border-red-500/20"
                style={{ backgroundColor: `${colors.failed}15`, borderColor: `${colors.failed}30` }}
              >
                <Text variant="caption" className="text-red-500 font-uiMedium text-[10px]" style={{ color: colors.failed }}>Sign Out</Text>
              </TouchableOpacity>

              {/* Info */}
              <View className="items-start">
                <Text variant="body" className="font-uiMedium text-left">
                  {item.name}
                </Text>
                <Text variant="caption" className="opacity-70 mt-0.5 text-left text-[10px]">
                  {item.location} • {item.lastActive}
                </Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
