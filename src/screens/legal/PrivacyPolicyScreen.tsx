/**
 * frontend/src/screens/legal/PrivacyPolicyScreen.tsx
 * ---------------------------------------------------------------------------
 * Privacy Policy Screen.
 * Renders the privacy document locally inside the app (App Store review compliant).
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";

export const PrivacyPolicyScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Header bar */}
      <View 
        className="flex-row items-center justify-between px-6 py-4 border-b border-borderHairline"
        style={{ borderBottomColor: colors.borderHairline, backgroundColor: colors.canvasBase }}
      >
        <View className="w-10" />
        <Text variant="h3" className="font-uiSemiBold">Privacy Policy</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">Close →</Text>
        </TouchableOpacity>
      </View>

      {/* Document scroll */}
      <ScrollView contentContainerStyle={{ padding: 24 }} className="space-y-4">
        <Text variant="h2" className="font-uiSemiBold text-left">Issac Privacy Policy</Text>
        <Text variant="caption" className="text-left opacity-60">Last Updated: July 2026</Text>

        <Text variant="body" className="text-left leading-6 mt-4">
          At Issac, we are committed to protecting your private information and project source codes. This document explains what information we collect and how we use it.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">1. Information Collected</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          - **Account Information**: Your email and registration details are stored securely.
          - **Source Codes**: Your project codes are sent to temporary E2B containers only for analysis and assistant functionality, and are deleted upon session exit.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">2. Source Code Security</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          - All connections are encrypted using SSL certificates.
          - Modifying source codes are stored in isolated E2B containers and no third party will have access to them.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">3. Right to Delete Information</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          You can permanently delete your account and all project data at any time by going to the account settings section.
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
};
