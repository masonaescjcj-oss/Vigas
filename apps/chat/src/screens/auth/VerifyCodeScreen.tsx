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
import { Platform, Pressable, SafeAreaView, Text as RNText, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { monoFamily } from "../../theme/mono";
import { LCD, glow, keyEdge, wellShadow } from "../../theme/device";
import { supabase } from "../../services/supabase";
import { notify } from "../../services/notify";
import { readText } from "../../services/clipboard";
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
  const { colors, mode } = useTheme();
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

  // Keypad entry. Each press appends a digit; the sixth one submits, exactly
  // as typing into the field does.
  const press = (digit: string) => {
    if (busy) return;
    const next = normaliseOtp(code + digit);
    setCode(next);
    if (isCompleteOtp(next)) void verify(next);
  };

  const deleteDigit = () => {
    if (busy) return;
    setCode((value) => value.slice(0, -1));
  };

  const paste = async () => {
    if (busy) return;
    const text = await readText();
    const next = text ? normaliseOtp(text) : "";
    if (!next) {
      notify("Nothing to paste", "Copy the code from the email first.");
      return;
    }
    setCode(next);
    if (isCompleteOtp(next)) void verify(next);
  };

  const cells = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? "");
  const keyStyle = [
    { flex: 1, height: 58, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: "center" as const, justifyContent: "center" as const },
    keyEdge(colors.capEdge),
  ];
  const digitFace = { fontSize: 24, lineHeight: 28, letterSpacing: 0 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="" divider={false} />
      <View className="flex-1 px-6 pb-6">
        <View className="mt-1 mb-6">
          <Text variant="h1" style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }}>
            {isRecovery ? "Enter the reset code." : "Check your inbox."}
          </Text>
          <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
            We sent a {OTP_LENGTH}-digit code to {maskEmail(email)}. It works for an hour.
          </Text>
        </View>

        {/* A calculator's segment display. The unlit "8" behind every digit is
            what an LCD shows when a segment is off — it says how many digits
            there are before any are typed. Tapping it focuses a real field
            underneath, so the system keyboard, one-time-code autofill and
            paste all still work. */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          accessibilityLabel={`Verification code, ${code.length} of ${OTP_LENGTH} digits entered`}
          style={[{ borderRadius: 18, backgroundColor: LCD.body, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }, wellShadow(mode)]}
        >
          <View className="flex-row justify-between mb-1">
            <Text variant="label" style={{ fontSize: 11, color: LCD.legend }}>code</Text>
            <Text variant="label" style={{ fontSize: 11, color: LCD.legend }}>{`${code.length} of ${OTP_LENGTH}`}</Text>
          </View>
          <View className="flex-row">
            {cells.map((digit, i) => (
              <View key={i} style={{ flex: 1, height: 60, alignItems: "center", justifyContent: "center" }}>
                <RNText style={{ position: "absolute", fontFamily: monoFamily("medium"), fontSize: 44, color: LCD.ghost }}>8</RNText>
                {digit ? (
                  <RNText style={{ fontFamily: monoFamily("medium"), fontSize: 44, color: LCD.ink }}>{digit}</RNText>
                ) : i === code.length ? (
                  <View style={[{ position: "absolute", bottom: 8, width: 22, height: 3, borderRadius: 2, backgroundColor: colors.brandPrimary }, glow(colors.brandPrimary, 8)]} />
                ) : null}
              </View>
            ))}
          </View>

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
            // A hardware keyboard on the web types straight in; on a phone the
            // keypad below is the main way, so the system keyboard stays shut
            // until the display is tapped.
            autoFocus={Platform.OS === "web"}
            maxLength={OTP_LENGTH}
            editable={!busy}
            caretHidden
            accessibilityLabel="Verification code"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: "transparent", outlineStyle: "none" } as object}
          />
        </Pressable>

        <TouchableOpacity
          onPress={() => void resend()}
          disabled={cooldown > 0 || busy}
          className="items-center py-3 mt-2"
          accessibilityRole="button"
          activeOpacity={0.6}
        >
          <Text variant="label" style={{ color: cooldown > 0 ? colors.inkMuted : colors.brandPrimary }}>
            {cooldown > 0 ? `send another code in ${formatCooldown(cooldown)}` : "send another code"}
          </Text>
        </TouchableOpacity>

        <View className="flex-1" />

        <View style={{ gap: 10, marginBottom: 12 }}>
          {[["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].map((row) => (
            <View key={row[0]} className="flex-row" style={{ gap: 10 }}>
              {row.map((digit) => (
                <TouchableOpacity key={digit} onPress={() => press(digit)} style={keyStyle} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={digit}>
                  <Text variant="h2" style={digitFace}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity onPress={() => void paste()} style={{ flex: 1, height: 58, alignItems: "center", justifyContent: "center" }} activeOpacity={0.6} accessibilityRole="button">
              <Text variant="label">paste</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => press("0")} style={keyStyle} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="0">
              <Text variant="h2" style={digitFace}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteDigit} style={keyStyle} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Delete digit">
              <Icon name="delete" size={22} color={colors.inkSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <Button
          label={busy ? "Checking…" : "Continue"}
          block
          loading={busy}
          disabled={!isCompleteOtp(code)}
          onPress={() => void verify(code)}
        />
      </View>
    </SafeAreaView>
  );
};
