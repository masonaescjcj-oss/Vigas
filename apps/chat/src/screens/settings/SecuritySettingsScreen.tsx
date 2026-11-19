/**
 * frontend/src/screens/settings/SecuritySettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * What the app can honestly say about security, and the one thing it can do.
 *
 * Listing or revoking sessions on other devices needs Supabase's admin session
 * APIs, which are service-role only; biometrics and 2FA are not implemented.
 * So this screen says where the password lives, says why there is no device
 * list, and offers to end this device's session. An invented device list
 * would be worse than none.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { notify } from "../../services/notify";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { SettingsRow } from "../../components/SettingsRow";
import { Card } from "../../components/ui/Card";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { type ProfileStackParamList } from "../../types/navigation";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "SecuritySettings">;

export const SecuritySettingsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e: any) {
      notify("Could not sign out", e?.message ?? "Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="Security" divider={false} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <SectionTitle first>Password</SectionTitle>
        <Card flush>
          <SettingsRow
            label="Change password"
            icon="lock"
            hint="In Account settings"
            onPress={() => navigation.navigate("AccountSettings")}
            last
          />
        </Card>

        <SectionTitle hint="Other devices cannot be listed or signed out from here yet — that needs a server-side API this build does not expose. Signing out below ends this device's session only.">
          Sessions
        </SectionTitle>
        <View className="px-1 mt-2">
          <Button label="Sign out on this device" tone="danger" onPress={() => void handleSignOut()} />
        </View>

        <Text variant="caption" className="px-1 mt-8" style={{ color: colors.inkMuted, lineHeight: 18 }}>
          Two-factor sign-in and biometric unlock are not available in this version.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
