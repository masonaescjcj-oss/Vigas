/**
 * frontend/src/screens/settings/AboutScreen.tsx
 * ---------------------------------------------------------------------------
 * The name, the version, one paragraph, and the two legal documents the
 * stores require to be reachable from inside the app.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { Card } from "../../components/ui/Card";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { type ProfileStackParamList } from "../../types/navigation";
import appConfig from "../../../app.json";

/** Single source of truth for the version shown to users. */
const APP_VERSION = appConfig.expo.version;

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "About">;

export const AboutScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="About" divider={false} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View className="px-1 pt-4 pb-8">
          <View className="flex-row items-baseline">
            <Text style={{ fontSize: 30, fontWeight: "500", letterSpacing: -0.5, color: colors.inkPrimary }}>
              vigas
            </Text>
            <Text style={{ fontSize: 30, fontWeight: "500", letterSpacing: -0.5, color: colors.brandPrimary }}>
              .
            </Text>
          </View>
          <Text variant="caption" className="mt-1" style={{ color: colors.inkMuted }}>Version {APP_VERSION}</Text>

          <Text variant="body" className="mt-5" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            Vigas AI chat and coding agent. Ask anything or describe what you want; it plans, writes, and runs code in an
            isolated cloud sandbox, then previews the result live.
          </Text>
        </View>

        <Card flush>
          <SettingsRow label="Privacy policy" onPress={() => navigation.navigate("PrivacyPolicy")} />
          <SettingsRow label="Terms of service" onPress={() => navigation.navigate("TermsOfService")} last />
        </Card>

        <Text variant="caption" className="text-center mt-10" style={{ color: colors.inkMuted }}>
          © 2026 Vigas
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
