/**
 * frontend/src/screens/legal/TermsOfServiceScreen.tsx
 * ---------------------------------------------------------------------------
 * Terms of Service Screen.
 * Renders terms agreement locally inside the app (App Store review compliant).
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { useTheme } from "../../theme/ThemeProvider";

export const TermsOfServiceScreen = () => {
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
        <Text variant="h3" className="font-uiSemiBold">Terms of Service</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">Close →</Text>
        </TouchableOpacity>
      </View>

      {/* Document scroll */}
      <ScrollView contentContainerStyle={{ padding: 24 }} className="space-y-4">
        <Text variant="h2" className="font-uiSemiBold text-left">Retro Code Terms of Service</Text>
        <Text variant="caption" className="text-left opacity-60">The current version is published with the app listing.</Text>

        <Text variant="body" className="text-left leading-6 mt-4">
          By registering and using the Retro Code coding assistant services, you agree to all the provisions of the rules below.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">1. Account Rules</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          - Each user is allowed personal and fair use of the bot.
          - Any attempt to reverse engineer the queuing system or breach Sandbox servers is prohibited and will result in immediate termination of access.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">2. Payments and Subscription</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          - In-app purchases are subject to the payment gateways and policies of the respective stores.
          - Subscription cancellation must be done before the renewal date.
        </Text>

        <Text variant="h3" className="font-uiSemiBold text-left mt-6">3. Disclaimer</Text>
        <Text variant="body" className="text-left leading-6 mt-2">
          - Retro Code makes every effort to write flawless code, but the final responsibility for testing and deploying codes in staging or production environments lies with the project developer.
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
};
