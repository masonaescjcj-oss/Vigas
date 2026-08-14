/**
 * frontend/src/screens/settings/ProfileMainScreen.tsx
 * ---------------------------------------------------------------------------
 * Main Profile Screen:
 *   - Avatar uploader alert.
 *   - Account details and subscription manager shortcuts.
 *   - List of SettingsRows navigating to sub-preferences screens.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, ScrollView, TouchableOpacity, Alert, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { SettingsRow } from "../../components/SettingsRow";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { type ProfileStackParamList } from "../../types/navigation";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">;

export const ProfileMainScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { profile, signOut } = useAuthStore();

  const handleAvatarChange = () => {
    Alert.alert(
      "Change Avatar",
      "Selecting image from gallery or camera is simulated in dev environment.",
      [{ text: "Camera" }, { text: "Gallery" }, { text: "Cancel", style: "cancel" }]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: signOut }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* User Card with Avatar */}
        <View className="items-center py-8 border-b border-borderHairline/20" style={{ borderBottomColor: colors.borderHairline }}>
          <TouchableOpacity 
            onPress={handleAvatarChange}
            className="w-20 h-20 rounded-full items-center justify-center bg-surfaceRaised border border-borderHairline mb-4"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          >
            <Text className="text-3xl">👤</Text>
            {/* Tiny camera overlay badge */}
            <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-brandPrimary items-center justify-center" style={{ backgroundColor: colors.brandPrimary }}>
              <Text className="text-white text-[10px]">📷</Text>
            </View>
          </TouchableOpacity>

          <Text variant="h2" className="font-uiSemiBold text-center">
            {profile?.display_name || "Issac User"}
          </Text>
          <Text variant="caption" className="opacity-80 text-center mt-1">
            {profile?.email || "email@issac.dev"}
          </Text>

          {/* Subscription status badge */}
          <TouchableOpacity 
            onPress={() => navigation.getParent()?.navigate("Paywall", {})}
            className="py-1 px-4 rounded-pill mt-4 flex-row items-center"
            style={{ backgroundColor: `${colors.brandPrimary}15` }}
          >
            <Text variant="caption" className="font-uiMedium mr-1.5" style={{ color: colors.brandPrimary }}>
              Current Plan: {profile?.subscription_tier?.toUpperCase() || "FREE"}
            </Text>
            <Text variant="caption" style={{ color: colors.brandPrimary }}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Rows list */}
        <View className="mt-4">
          <SettingsRow
            label="Account Settings"
            icon="👤"
            onPress={() => navigation.navigate("AccountSettings")}
          />
          <SettingsRow
            label="Preferences"
            icon="🎨"
            onPress={() => navigation.navigate("Preferences")}
          />
          <SettingsRow
            label="Security"
            icon="🔒"
            onPress={() => navigation.navigate("SecuritySettings")}
          />
          <SettingsRow
            label="Help & Support"
            icon="❓"
            onPress={() => navigation.navigate("HelpSupport")}
          />
          <SettingsRow
            label="About"
            icon="ℹ️"
            onPress={() => navigation.navigate("About")}
          />
        </View>

        {/* Exit row */}
        <View className="mt-8 px-4">
          <TouchableOpacity
            onPress={handleSignOut}
            className="w-full bg-red-500/10 border border-red-500/20 py-3.5 rounded-pill items-center justify-center"
            style={{ backgroundColor: `${colors.failed}10`, borderColor: `${colors.failed}30` }}
          >
            <Text variant="body" className="font-uiMedium text-red-500" style={{ color: colors.failed }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
