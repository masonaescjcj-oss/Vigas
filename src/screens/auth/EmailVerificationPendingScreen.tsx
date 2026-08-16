/**
 * frontend/src/screens/auth/EmailVerificationPendingScreen.tsx
 * ============================================================================
 * EMAIL VERIFICATION PENDING SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 * 
 * BACKEND INTEGRATION ARCHITECTURE & LOGIC:
 * 1. REGISTRATION PENDING FLOW:
 *    Displayed immediately after a user registers a new account on `SignUpScreen.tsx`.
 * 2. COOLDOWN COUNTDOWN TIMER (60s):
 *    Prevents email spam by disabling the resend button for 60 seconds after trigger.
 * 3. BACKEND API INTEGRATION POINT:
 *    Calls `supabase.auth.signUp({ email })` or issues HTTP POST request to
 *    Deno backend API `POST /api/auth/resend-verification`.
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { View, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { Icon } from "../../components/Icon";
import { notify } from "../../services/notify";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../theme/ThemeProvider";

type RouteProps = RouteProp<AuthStackParamList, "EmailVerificationPending">;

export const EmailVerificationPendingScreen = () => {
  const { colors } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { email } = route.params;

  // --------------------------------------------------------------------------
  // STATE MANAGEMENT & COOLDOWN CONTROLLER
  // --------------------------------------------------------------------------
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  /**
   * COOLDOWN COUNTDOWN TIMER LOOP (60 SECONDS)
   */
  useEffect(() => {
    if (cooldown === 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  /**
   * RESEND VERIFICATION EMAIL HANDLER
   * BACKEND INTEGRATION POINT: `POST /api/auth/resend-verification`
   */
  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      // The correct API for this is auth.resend — signUp would try to create a
      // second account with a throwaway password.
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      notify("Resent", "Verification email has been resent.");
      setCooldown(60);
    } catch (e: any) {
      notify("Could not resend", e?.message ?? "Please try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.canvasBase }} className="flex-1 justify-center px-6">
      
      <View className="items-center mb-8">
        {/* Verification Emblem */}
        <View style={{ backgroundColor: colors.surfaceRaised }} className="w-20 h-20 rounded-3xl items-center justify-center mb-6 shadow-2xl">
          <Icon name="mail" size={36} color={colors.brandPrimary} />
        </View>

        <Text className="text-white text-3xl font-extrabold text-center mb-2 font-sans">
          Verify Your Account
        </Text>

        <Text className="text-zinc-400 text-sm text-center leading-6 max-w-[90%]">
          A verification link has been sent to:
        </Text>

        <Text className="text-purple-300 text-base font-bold text-center mt-2 mb-2 font-mono">
          {email}
        </Text>

        <Text className="text-zinc-400 text-xs text-center leading-5 max-w-[85%]">
          Please check your inbox and tap the activation link to activate your Retro Code workspace.
        </Text>
      </View>

      <View className="space-y-3">
        {/* Resend Email Button with Dynamic Cooldown */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
          style={{ backgroundColor: colors.brandPrimary,  opacity: cooldown > 0 ? 0.6 : 1.0 }}
          className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-2xl mb-3"
        >
          <Text className="text-white text-base font-bold tracking-wide">
            {cooldown > 0 ? `Resend Email (${cooldown}s)` : resending ? "Resending..." : "Resend Verification Email"}
          </Text>
        </TouchableOpacity>

        {/* Back to Sign In Action Button */}
        <TouchableOpacity style={{ backgroundColor: colors.surfaceRaised }}
          onPress={() => navigation.navigate("Login")}
          className="w-full py-4 rounded-2xl items-center justify-center active:"
        >
          <Text className="text-zinc-300 text-sm font-semibold">Back to Sign In</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};
