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
import { Icon } from "../../components/Icon";
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View className="flex-1 justify-center px-6">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="absolute top-4 left-4 p-2"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={20} color={colors.inkSecondary} />
        </TouchableOpacity>

        <View
          className="w-12 h-12 rounded-2xl items-center justify-center mb-5 border"
          style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.borderHairline }}
        >
          <Icon name="mail" size={22} color={colors.brandPrimary} />
        </View>

        <Text variant="h2" className="font-uiSemiBold text-left mb-2">
          {isRecovery ? "Enter your reset code" : "Enter your code"}
        </Text>
        <Text variant="caption" className="text-left opacity-70 leading-5 mb-7">
          We sent a {OTP_LENGTH}-digit code to {maskEmail(email)}.
        </Text>

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
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={OTP_LENGTH}
          editable={!busy}
          accessibilityLabel="Verification code"
          className="rounded-2xl border text-center"
          style={{
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.borderHairline,
            color: colors.inkPrimary,
            fontSize: 30,
            letterSpacing: 12,
            paddingVertical: 16,
            fontFamily: "JetBrainsMono_500Medium",
          }}
        />

        <TouchableOpacity
          onPress={() => void verify(code)}
          disabled={!isCompleteOtp(code) || busy}
          className="w-full py-4 rounded-2xl items-center justify-center mt-5"
          accessibilityRole="button"
          style={{
            backgroundColor: colors.brandPrimary,
            opacity: !isCompleteOtp(code) || busy ? 0.4 : 1,
          }}
        >
          <Text style={{ color: colors.canvasBase }} className="font-uiSemiBold">
            {busy ? "Checking…" : "Continue"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void resend()}
          disabled={cooldown > 0 || busy}
          className="items-center mt-5 py-2"
          accessibilityRole="button"
        >
          <Text
            variant="caption"
            style={{ color: cooldown > 0 ? colors.inkMuted : colors.brandPrimary }}
          >
            {cooldown > 0 ? `Send another code in ${formatCooldown(cooldown)}` : "Send another code"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
