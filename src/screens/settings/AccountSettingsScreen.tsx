/**
 * frontend/src/screens/settings/AccountSettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Account Settings Screen:
 *   - Edit display name, change email.
 *   - Update account password.
 *   - Delete Account verification flow (two-step).
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, Alert, ScrollView, SafeAreaView, TouchableOpacity } from "react-native";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";
import { invokeFunction } from "../../services/functionsClient";

export const AccountSettingsScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile, loadProfile, signOut } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [email, setEmail] = useState(profile?.email || "");
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deleteWord, setDeleteWord] = useState("");
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", profile?.id!);

      if (error) throw error;
      await loadProfile();
      notify("Profile Updated", "Display name changed successfully.");
    } catch (e: any) {
      notify("Error", e.message || "Update failed.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      notify("Error", "Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      notify("Password Updated", "Your password has been changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteWord !== "DELETE") {
      notify("Error", "Please type 'DELETE' to confirm.");
      return;
    }

    setDeletingAccount(true);
    try {
      // Real deletion: removes Storage objects then the auth user (rows cascade).
      await invokeFunction("user-delete", { method: "POST" });
      notify("Account deleted", "Your account, projects and files have been permanently deleted.");
      await signOut();
    } catch (e: any) {
      // Never claim success here — the account still exists.
      notify("Could not delete the account", e?.message ?? "Please try again or contact support.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
            <Text variant="body" className="font-uiMedium">← Back</Text>
          </TouchableOpacity>
          <Text variant="h2" className="font-uiSemiBold">Account Settings</Text>
        </View>

        {/* Profile Card Info */}
        <View className="space-y-4 mb-6">
          <Text variant="label" className="text-left">Edit Profile</Text>
          <View>
            <Text variant="caption" className="mb-1 font-uiMedium text-left">Display Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <Button
            label="Update Name"
            onPress={handleSaveProfile}
            loading={savingProfile}
            className="w-full"
          />
        </View>

        <View className="h-[1px] bg-borderHairline my-6" style={{ backgroundColor: colors.borderHairline }} />

        {/* Password Card Info */}
        <View className="space-y-4 mb-6">
          <Text variant="label" className="text-left">Change Password</Text>
          
          <View className="mt-3">
            <Text variant="caption" className="mb-1 font-uiMedium text-left">New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <View className="mt-3">
            <Text variant="caption" className="mb-1 font-uiMedium text-left">Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
            />
          </View>

          <Button
            label="Update Password"
            onPress={handleUpdatePassword}
            loading={updatingPassword}
            className="w-full"
          />
        </View>

        <View className="h-[1px] bg-borderHairline my-6" style={{ backgroundColor: colors.borderHairline }} />

        {/* Danger zone delete */}
        <View 
          className="p-5 rounded-card border-2"
          style={{ borderColor: `${colors.failed}30`, backgroundColor: `${colors.failed}05` }}
        >
          <Text variant="h3" className="font-uiSemiBold text-red-500 text-left mb-2" style={{ color: colors.failed }}>
            Delete Account
          </Text>
          <Text variant="caption" className="text-left mb-3 opacity-90 leading-5">
            By deleting your account, all projects, chat histories, and sandbox files will be permanently erased, and Pro subscriptions will be canceled.
          </Text>

          <Text variant="caption" className="text-left mb-2 font-uiMedium">
            Type 'DELETE' to confirm:
          </Text>
          <TextInput
            value={deleteWord}
            onChangeText={setDeleteWord}
            placeholder="DELETE..."
            placeholderTextColor={colors.inkSecondary}
            className="w-full bg-surfaceRaised p-3 rounded-input border border-borderHairline font-uiRegular text-sm text-left mb-4"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
          />

          <Button
            label="Delete Account Permanently"
            onPress={handleDeleteAccount}
            loading={deletingAccount}
            className="w-full"
            style={{ backgroundColor: colors.failed }}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};
