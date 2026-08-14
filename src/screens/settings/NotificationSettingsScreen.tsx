/**
 * frontend/src/screens/settings/NotificationSettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Notification Settings Screen:
 *   - Selective toggles for agent completions, usage alerts, promos, and system updates.
 *   - Global toggle for muting all.
 *   - Lockscreen privacy information caption.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";

export const NotificationSettingsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [muteAll, setMuteAll] = useState(false);
  const [agentDone, setAgentDone] = useState(true);
  const [tokenWarning, setTokenWarning] = useState(true);
  const [promos, setPromos] = useState(false);
  const [updates, setUpdates] = useState(true);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-borderHairline/20" style={{ borderBottomColor: colors.borderHairline }}>
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Notification Settings</Text>
        </View>

        {/* Global mute */}
        <View className="mt-4">
          <SettingsRow
            label="Mute All Notifications"
            hasSwitch
            switchValue={muteAll}
            onSwitchChange={(val) => {
              setMuteAll(val);
              if (val) {
                setAgentDone(false);
                setTokenWarning(false);
                setPromos(false);
                setUpdates(false);
              }
            }}
          />
        </View>

        {/* Individual toggles */}
        <View className="mt-4">
          <Text variant="label" className="px-6 mb-2 text-left">Receive notifications by topic</Text>
          
          <SettingsRow
            label="Agent execution completed successfully"
            hasSwitch
            switchValue={agentDone && !muteAll}
            onSwitchChange={setAgentDone}
          />

          <SettingsRow
            label="Token usage and limit warnings"
            hasSwitch
            switchValue={tokenWarning && !muteAll}
            onSwitchChange={setTokenWarning}
          />

          <SettingsRow
            label="Discounts and subscription offers"
            hasSwitch
            switchValue={promos && !muteAll}
            onSwitchChange={setPromos}
          />

          <SettingsRow
            label="System updates and news"
            hasSwitch
            switchValue={updates && !muteAll}
            onSwitchChange={setUpdates}
          />
        </View>

        {/* Privacy Note card */}
        <View 
          className="p-5 rounded-card border m-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text variant="label" className="text-left mb-2">🔒 About Privacy & Notifications</Text>
          <Text variant="caption" className="text-left leading-5 opacity-90">
            To protect your privacy and prevent exposing edited code on the Lock Screen, Issac does not include details of changed code in notifications and only sends the general status.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
