/**
 * frontend/src/screens/settings/AccountSettingsScreen.tsx
 * ---------------------------------------------------------------------------
 * Name, password, and the way out.
 *
 * Three sections, each a title, its fields and one button. Deleting the
 * account is the last section and its button is the danger tone — soft red,
 * not a solid red block, because the loudest thing on a settings page should
 * not be the one that erases everything. The typed "DELETE" gate stays.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { notify } from "../../services/notify";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../services/supabase";
import { invokeFunction } from "../../services/functionsClient";

export const AccountSettingsScreen = () => {
  const { colors } = useTheme();
  const { profile, loadProfile, signOut } = useAuthStore();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
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
      notify("Saved", "Your name has been updated.");
    } catch (e: any) {
      notify("Could not save", e.message || "Update failed.");
    } finally {
      setSavingProfile(false);
    }
  };

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      notify("Check the form", "The two passwords do not match.");
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      notify("Password changed", "Use it the next time you sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      notify("Could not change the password", e.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteWord !== "DELETE") {
      notify("Not deleted", "Type DELETE in capitals to confirm.");
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
      <ScreenHeader title="Account" divider={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SectionTitle first>Name</SectionTitle>
          <Input value={displayName} onChangeText={setDisplayName} placeholder="How you want to be called" />
          <Button label="Save" size="sm" tone="neutral" loading={savingProfile} disabled={!displayName.trim()} onPress={() => void handleSaveProfile()} />

          <SectionTitle>Password</SectionTitle>
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Once more"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={mismatch ? "Passwords do not match" : null}
          />
          <Button label="Change password" size="sm" tone="neutral" loading={updatingPassword} disabled={!newPassword || !confirmPassword} onPress={() => void handleUpdatePassword()} />

          <SectionTitle hint="Every project, chat and file is erased and cannot be recovered.">
            Delete account
          </SectionTitle>
          <Input
            value={deleteWord}
            onChangeText={setDeleteWord}
            placeholder="Type DELETE to confirm"
            autoCapitalize="characters"
          />
          <Button
            label="Delete my account"
            tone="danger"
            block
            loading={deletingAccount}
            disabled={deleteWord !== "DELETE"}
            onPress={() => void handleDeleteAccount()}
          />
          <View style={{ height: 8 }} />
          <Text variant="caption" style={{ color: colors.inkMuted }}>
            Signed in as {profile?.email ?? "—"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
