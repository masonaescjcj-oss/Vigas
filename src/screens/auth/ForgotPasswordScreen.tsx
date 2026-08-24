/**
 * frontend/src/screens/auth/ForgotPasswordScreen.tsx
 * ============================================================================
 * FORGOT PASSWORD RECOVERY SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 * 
 * BACKEND INTEGRATION ARCHITECTURE & LOGIC:
 * 1. FORM VALIDATION LOGIC:
 *    Checks if `email` input is non-empty and formatted correctly using regex.
 * 2. BACKEND API INTEGRATION POINT:
 *    Executes Supabase Auth `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
 *    or issues HTTP POST request to Deno API `POST /api/auth/forgot-password`.
 * 3. DEEP LINK REDIRECT:
 *    Directs the user to `retrocode://reset-password` deep link scheme to launch
 *    `ResetPasswordScreen.tsx` seamlessly on mobile or web.
 * ============================================================================
 */

import React, { useState } from "react";
import { View, TextInput, Alert, SafeAreaView, TouchableOpacity } from "react-native";
import { Icon } from "../../components/Icon";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../theme/ThemeProvider";

export const ForgotPasswordScreen = () => {
  const { colors } = useTheme();
  // Typed, so a route name that does not exist is a compile error rather
  // than a dead button.
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT & FORM CONTROLLERS
  // --------------------------------------------------------------------------
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  /**
   * RECOVERY TRIGGER HANDLER
   * BACKEND INTEGRATION POINT: `POST /api/auth/forgot-password`
   */
  const handleReset = async () => {
    // 1. Validate non-empty email
    if (!email.trim()) {
      notify("Error", "Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      // No redirectTo: the email carries a six-digit code now, not a link, so
      // there is nowhere to come back to. The user types it on the next screen.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      navigation.navigate("VerifyCode", { email: email.trim(), purpose: "recovery" });
    } catch (e: any) {
      notify("Could not send the code", e?.message ?? "Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.canvasBase }} className="flex-1 justify-center px-6">
      
      {/* Brand Header */}
      <View className="mb-8">
        <View className="flex-row items-center mb-3">
          <Icon name="ghost" size={22} color={colors.brandPrimary} style={{ marginRight: 8 }} />
          <Text className="text-white text-xl font-bold tracking-wider font-mono">RETRO CODE</Text>
        </View>
        
        <Text className="text-white text-3xl font-extrabold text-left mb-2 font-sans">
          Forgot Password
        </Text>

        <Text className="text-zinc-400 text-sm text-left leading-6">
          Enter your email to receive a password reset link for your Retro Code account.
        </Text>
      </View>

      {sent ? (
        /* Confirmation Success Card */
        <View style={{ backgroundColor: colors.surfaceRaised }} className=" p-6 rounded-3xl items-center shadow-2xl">
          <Icon name="mail" size={44} color={colors.success} style={{ marginBottom: 16 }} />

          <Text className="text-white text-lg font-bold text-center mb-2">
            Reset Link Sent Successfully
          </Text>

          <Text className="text-zinc-400 text-xs text-center leading-6 mb-6">
            We have sent password recovery instructions to <Text className="text-purple-300 font-bold">{email}</Text>. Check your inbox to proceed.
          </Text>

          <TouchableOpacity style={{ backgroundColor: colors.brandPrimary }} 
            onPress={() => navigation.goBack()} 
            className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
          >
            <Text className="text-white text-base font-bold">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Password Reset Form */
        <View className="space-y-4">
          <View className="mb-6">
            <Text className="text-zinc-200 text-sm font-bold text-left mb-2">Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="developer@retrocode.dev"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              className="w-full p-4 rounded-2xl text-white text-base text-left"
              style={{ backgroundColor: colors.surfaceRaised,  color: colors.inkPrimary, outlineStyle: "none", outlineWidth: 0 } as any}
            />
          </View>

          {/* Send Reset Link Action Button */}
          <TouchableOpacity style={{ backgroundColor: colors.brandPrimary }}
            onPress={handleReset}
            disabled={loading}
            className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-2xl mb-3"
          >
            <Text className="text-white text-base font-bold tracking-wide">
              {loading ? "Sending Reset Link..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>

          {/* Back Action Button */}
          <TouchableOpacity style={{ backgroundColor: colors.surfaceRaised }}
            onPress={() => navigation.goBack()}
            className="w-full py-4 rounded-2xl items-center justify-center active:"
          >
            <Text className="text-zinc-300 text-sm font-semibold">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
};
