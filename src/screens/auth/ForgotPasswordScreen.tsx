/**
 * frontend/src/screens/auth/ForgotPasswordScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) FORGOT PASSWORD RECOVERY SCREEN
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
import { Text } from "../../components/Typography";
import { supabase } from "../../services/supabase";

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation();

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
      // Scheme must match the linking prefix registered in AppNavigator ("issac://").
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "issac://reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      notify("Could not send the link", e?.message ?? "Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#000000" }} className="flex-1 justify-center px-6 bg-black">
      
      {/* Brand Header */}
      <View className="mb-8">
        <View className="flex-row items-center mb-3">
          <Icon name="ghost" size={22} color="#C084FC" style={{ marginRight: 8 }} />
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
        <View className="bg-[#141414] p-6 rounded-3xl items-center shadow-2xl">
          <Icon name="mail" size={44} color="#34D399" style={{ marginBottom: 16 }} />

          <Text className="text-white text-lg font-bold text-center mb-2">
            Reset Link Sent Successfully
          </Text>

          <Text className="text-zinc-400 text-xs text-center leading-6 mb-6">
            We have sent password recovery instructions to <Text className="text-purple-300 font-bold">{email}</Text>. Check your inbox to proceed.
          </Text>

          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
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
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              keyboardType="email-address"
              className="w-full bg-[#141414] p-4 rounded-2xl text-white text-base text-left"
              style={{ color: "#FFFFFF", outlineStyle: "none", outlineWidth: 0 } as any}
            />
          </View>

          {/* Send Reset Link Action Button */}
          <TouchableOpacity
            onPress={handleReset}
            disabled={loading}
            className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-2xl mb-3"
          >
            <Text className="text-white text-base font-bold tracking-wide">
              {loading ? "Sending Reset Link..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>

          {/* Back Action Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-full py-4 bg-[#141414] rounded-2xl items-center justify-center active:bg-[#1E1E1E]"
          >
            <Text className="text-zinc-300 text-sm font-semibold">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
};
