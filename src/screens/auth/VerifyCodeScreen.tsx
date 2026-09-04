/**
 * frontend/src/screens/auth/VerifyCodeScreen.tsx
 * ---------------------------------------------------------------------------
 * Entering the code from the email.
 *
 * One screen for both flows. Signing up and resetting a password differ only
 * in which `type` verifyOtp is given and where the user goes afterwards, and
 * two screens that share their whole body drift apart the first time one is
 * fixed.
 *
 * A code rather than a link because the link had to leave the app, open a
 * browser, and hand a session back — and because while site_url pointed at
 * localhost, every one of those links led nowhere.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { SafeAreaView, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { supabase } from "../../services/supabase";
import { notify } from "../../services/notify";
import {
  describeOtpError,
  formatCooldown,
  isCompleteOtp,
  maskEmail,
  normaliseOtp,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
} from "../../core/auth/otp";

type RouteProps = RouteProp<AuthStackParamList, "VerifyCode">;

export const VerifyCodeScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { email, purpose } = route.params;

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  const isRecovery = purpose === "recovery";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (busy || !isCompleteOtp(value)) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: normaliseOtp(value),
        // "email" confirms a new account; "recovery" opens a session that is
        // only good for setting a password. They are different grants and the
        // server enforces the difference.
        type: isRecovery ? "recovery" : "email",
      });
      if (error) throw error;

      // Signing up leaves a real session, and the navigator swaps itself out
      // once it sees one — so there is nothing to do here. Recovery has to go
      // on to the screen that actually sets the password.
      if (isRecovery) navigation.replace("ResetPassword", {});
    } catch (e: any) {
      notify("Could not verify", describeOtpError(e?.message));
      setCode("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      const { error } = isRecovery
        ? await supabase.auth.resetPasswordForEmail(email)
        // resend, not signUp: signUp on an existing address either errors or
        // silently does nothing depending on the project's settings.
        : await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN_SECONDS);
      notify("Sent", `A new code is on its way to ${maskEmail(email)}.`);
    } catch (e: any) {
      notify("Could not send another code", describeOtpError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="" divider={false} />
      <View className="flex-1 px-6 pb-6">
        <View className="mb-8 mt-2">
          <Text variant="h1" className="font-uiSemiBold">
            {isRecovery ? "Enter the reset code" : "Check your email"}
          </Text>
          <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            We sent a {OTP_LENGTH}-digit code to {maskEmail(email)}.
          </Text>
        </View>

        {/* One field rather than six boxes: six inputs need focus plumbing that
            breaks paste, and paste is how most people enter a code. */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => {
            const next = normaliseOtp(value);
            setCode(next);
            // Submit itself once it is complete. Nobody wants to reach for a
            // button after typing the last digit.
            if (isCompleteOtp(next)) void verify(next);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={OTP_LENGTH}
          editable={!busy}
          accessibilityLabel="Verification code"
          placeholder={"•".repeat(OTP_LENGTH)}
          placeholderTextColor={colors.inkMuted}
          className="rounded-input text-center"
          style={{
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: focused ? colors.brandPrimary : colors.borderHairline,
            color: colors.inkPrimary,
            fontSize: 28,
            letterSpacing: 10,
            paddingVertical: 14,
            fontFamily: "JetBrainsMono_500Medium",
            outlineStyle: "none",
            outlineWidth: 0,
          } as object}
        />

        <Button
          label={busy ? "Checking…" : "Continue"}
          block
          loading={busy}
          disabled={!isCompleteOtp(code)}
          onPress={() => void verify(code)}
          className="mt-4"
        />

        <TouchableOpacity
          onPress={() => void resend()}
          disabled={cooldown > 0 || busy}
          className="items-center mt-6 py-2"
          accessibilityRole="button"
          activeOpacity={0.6}
        >
          <Text
            variant="body"
            className={cooldown > 0 ? "" : "font-uiMedium"}
            style={{ color: cooldown > 0 ? colors.inkMuted : colors.brandPrimary }}
          >
            {cooldown > 0 ? `Send another code in ${formatCooldown(cooldown)}` : "Send another code"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
