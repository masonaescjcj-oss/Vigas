/**
 * frontend/src/screens/auth/ResetPasswordScreen.tsx
 * ---------------------------------------------------------------------------
 * Choosing a new password once the reset code has been accepted.
 *
 * `updateUser({ password })` needs the session the code (or, on an old link,
 * hooks/usePasswordRecovery.ts) creates. The form is only offered once that
 * session exists; showing inputs that cannot work is how a lock-out bug here
 * stayed invisible for a long time. The three other states — link refused,
 * still checking, no session — each say what happened and offer the one way on.
 *
 * Layout matches the rest of the auth stack: header, title, fields, one button.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { View, ScrollView, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { notify } from "../../services/notify";
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

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      notify("Missing details", "Fill in both fields.");
      return;
    }
    if (mismatch) {
      notify("Check the form", "The two passwords do not match.");
      return;
    }
    if (tooShort) {
      notify("Check the form", `Use at least ${MIN_PASSWORD} characters.`);
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
    } catch (e: unknown) {
      errorFeedback();
      notify("Could not update the password", e instanceof Error ? e.message : "Request a new code and try again.");
    } finally {
      setLoading(false);
    }
  };

  // This can be the first screen in the stack (a deep link), so "back" must
  // have somewhere to go.
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Login"));

  const renderBody = () => {
    // A refused link is the common case — reset links are short-lived and
    // people read email later. Say what happened and what to do.
    if (recoveryError) {
      return (
        <Card>
          <Text variant="body" className="font-uiMedium" style={{ color: colors.failed }}>That link did not work</Text>
          <Text variant="caption" className="mt-1" style={{ color: colors.inkSecondary, lineHeight: 18 }}>
            {recoveryError}
          </Text>
          <Button
            label="Request a new code"
            tone="neutral"
            size="sm"
            className="mt-3"
            onPress={() => navigation.navigate("ForgotPassword")}
          />
        </Card>
      );
    }

    if (hasSession === null) {
      return (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color={colors.inkMuted} />
          <Text variant="caption" className="mt-3" style={{ color: colors.inkSecondary }}>Checking…</Text>
        </View>
      );
    }

    // No session means the form cannot possibly work. Offering it anyway is
    // exactly how this screen used to lie.
    if (!hasSession) {
      return (
        <Card>
          <Text variant="body" className="font-uiMedium">This screen needs your reset code</Text>
          <Text variant="caption" className="mt-1" style={{ color: colors.inkSecondary, lineHeight: 18 }}>
            Request a code, enter it on this device, and you will be brought back here.
          </Text>
          <Button
            label="Send me a code"
            tone="neutral"
            size="sm"
            className="mt-3"
            onPress={() => navigation.navigate("ForgotPassword")}
          />
        </Card>
      );
    }

    return (
      <>
        <Input
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={tooShort ? `At least ${MIN_PASSWORD} characters` : null}
          returnKeyType="next"
          autoFocus
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
          returnKeyType="go"
          onSubmitEditing={() => void handleUpdatePassword()}
        />
        <Button label="Save password" block loading={loading} onPress={() => void handleUpdatePassword()} className="mt-2" />
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="" divider={false} onBack={back} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 mt-2">
            <Text variant="h1" style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }}>Choose a new password</Text>
            <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
              You will sign in with it from now on.
            </Text>
          </View>
          {renderBody()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
