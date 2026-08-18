/**
 * frontend/src/screens/auth/ResetPasswordScreen.tsx
 * ---------------------------------------------------------------------------
 * Choosing a new password after following the emailed link.
 *
 * Two things were wrong here, and both locked people out:
 *
 *   1. `updateUser({ password })` needs the session the reset link creates, and
 *      nothing created one — so this always failed, and the error told the user
 *      to open the link again, which failed identically. See
 *      hooks/usePasswordRecovery.ts for the half that was missing.
 *   2. Every label was a hardcoded Tailwind `text-white` / `text-zinc-*`. On the
 *      light theme's near-white canvas that is invisible: a blank screen with a
 *      button on it.
 *
 * The form is only offered once a session actually exists. Showing inputs that
 * cannot work is how the original bug stayed invisible for so long.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, TextInput, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Icon } from "../../components/Icon";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { supabase } from "../../services/supabase";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../theme/ThemeProvider";
import { errorFeedback, successFeedback } from "../../services/haptics";

/** Supabase's own floor. Stating it up front beats failing after they type. */
const MIN_PASSWORD = 6;

export const ResetPasswordScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { recoveryError, signOut } = useAuthStore();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Null while unknown. The form waits rather than offering itself and failing.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Asked rather than assumed: the link may have been opened on another
    // device, or its one-use token may already have been spent.
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session);
    });
    // Re-check when the recovery hook finishes establishing a session.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setHasSession(!!session);
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, []);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      notify("Error", "Please fill in all password fields.");
      return;
    }
    if (password !== confirmPassword) {
      notify("Error", "New password and confirmation do not match.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      notify("Error", `New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      successFeedback();

      // Sign out deliberately. The recovery session is still live, and leaving it
      // would drop the user into the app while the message says to log in — and
      // would leave them signed in on whatever device opened the email.
      await signOut();
      notify("Password changed", "Sign in with your new password.");
      navigation.navigate("Login");
    } catch (e: any) {
      errorFeedback();
      notify("Could not update the password", e?.message ?? "Request a new reset link and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surfaceRaised,
    color: colors.inkPrimary,
    outlineStyle: "none",
    outlineWidth: 0,
  } as any;

  return (
    <SafeAreaView style={{ backgroundColor: colors.canvasBase }} className="flex-1 justify-center px-6">

      <View className="mb-8">
        <View className="flex-row items-center mb-3">
          <Icon name="lock" size={22} color={colors.brandPrimary} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.inkSecondary }} className="text-xl font-bold tracking-wider font-mono">
            RETRO CODE
          </Text>
        </View>

        <Text style={{ color: colors.inkPrimary }} className="text-3xl font-extrabold text-left mb-2 font-sans">
          Reset Password
        </Text>

        <Text style={{ color: colors.inkSecondary }} className="text-sm text-left leading-6">
          Choose a new password for your Retro Code account.
        </Text>
      </View>

      {/* A refused link is the common case — reset links are short-lived and
          people read email later. Say what happened and what to do. */}
      {recoveryError ? (
        <View
          className="p-4 rounded-2xl border mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.failed }}
        >
          <Text style={{ color: colors.failed }} className="text-sm font-bold text-left mb-1">
            That link did not work
          </Text>
          <Text style={{ color: colors.inkSecondary }} className="text-xs text-left leading-5">
            {recoveryError}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
            className="mt-3 self-start px-3 py-2 rounded-lg"
            style={{ backgroundColor: colors.surfaceMuted }}
          >
            <Text style={{ color: colors.brandPrimary }} className="text-xs font-bold">
              Request a new link
            </Text>
          </TouchableOpacity>
        </View>
      ) : hasSession === null ? (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color={colors.brandPrimary} />
          <Text style={{ color: colors.inkSecondary }} className="text-xs mt-3">
            Checking your reset link…
          </Text>
        </View>
      ) : !hasSession ? (
        // No session means the form cannot possibly work. Offering it anyway is
        // exactly how this screen used to lie.
        <View
          className="p-4 rounded-2xl border mb-6"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          <Text style={{ color: colors.inkPrimary }} className="text-sm font-bold text-left mb-1">
            Open the link from your email
          </Text>
          <Text style={{ color: colors.inkSecondary }} className="text-xs text-left leading-5">
            This screen needs the link we emailed you. Open it on this device — a
            link opened elsewhere cannot change the password here.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
            className="mt-3 self-start px-3 py-2 rounded-lg"
            style={{ backgroundColor: colors.surfaceMuted }}
          >
            <Text style={{ color: colors.brandPrimary }} className="text-xs font-bold">
              Send me a link
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="space-y-4">
          <View className="mb-4">
            <Text style={{ color: colors.inkPrimary }} className="text-sm font-bold text-left mb-2">
              New Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              className="w-full p-4 rounded-2xl text-base text-left"
              style={inputStyle}
            />
          </View>

          <View className="mb-6">
            <Text style={{ color: colors.inkPrimary }} className="text-sm font-bold text-left mb-2">
              Confirm New Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              className="w-full p-4 rounded-2xl text-base text-left"
              style={inputStyle}
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: colors.brandPrimary, opacity: loading ? 0.6 : 1 }}
            onPress={handleUpdatePassword}
            disabled={loading}
            className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-2xl"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.canvasBase} />
            ) : (
              <Text style={{ color: colors.canvasBase }} className="text-base font-bold tracking-wide">
                Update Password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
};
