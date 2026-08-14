/**
 * frontend/src/screens/settings/AboutScreen.tsx
 * ---------------------------------------------------------------------------
 * About screen showing app logo, version numbers, copyright indicators,
 * and links to internal Privacy Policy and Terms of Service documents.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { type ProfileStackParamList } from "../../types/navigation";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "About">;

export const AboutScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView className="flex-1 px-6 justify-between py-12" style={{ backgroundColor: colors.canvasBase }}>
      
      {/* Top Header Back button */}
      <View className="flex-row justify-start w-full">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text variant="body" className="font-uiMedium">← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Main Info */}
      <View className="items-center">
        <Text variant="h1" className="font-uiSemiBold text-5xl tracking-tighter mb-2">
          issac
        </Text>
        <Text variant="caption" className="opacity-80">Version 1.0.0 (build 240)</Text>
        
        <Text variant="body" className="text-center mt-6 px-8 leading-6 opacity-95">
          Issac is the first independent smart coding assistant on mobile operating systems that manages software development processes in cloud Sandbox environments.
        </Text>
      </View>

      {/* Legal routes (Mandatory App Store review requirements) */}
      <View className="w-full space-y-2 mt-8">
        <Text variant="label" className="text-left mb-2 px-2">Legal Documents</Text>
        
        <SettingsRow
          label="Privacy Policy"
          onPress={() => navigation.navigate("PrivacyPolicy")}
        />
        
        <SettingsRow
          label="Terms of Service"
          onPress={() => navigation.navigate("TermsOfService")}
        />

        {/* Copyright */}
        <Text variant="caption" className="text-center mt-8 opacity-50">
          © 2026 Issac Tech. All rights reserved.
        </Text>
      </View>

    </SafeAreaView>
  );
};
