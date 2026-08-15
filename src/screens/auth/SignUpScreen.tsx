/**
 * frontend/src/screens/auth/SignUpScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) SIGN UP SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { View, TextInput, Alert, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { Icon } from "../../components/Icon";
import { notify } from "../../services/notify";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { supabase } from "../../services/supabase";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../theme/store";
import { type AuthStackParamList } from "../../navigation/types";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

export const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { mode } = useThemeStore();

  const isLight = mode === "light";
  const bgCanvas = isLight ? "#FFFFFF" : "#000000";
  const bgCard = isLight ? "#F8FAFC" : "#141414";
  const bgInput = isLight ? "#F1F5F9" : "#141414";
  const textPrimary = isLight ? "#0F172A" : "#FFFFFF";
  const textSecondary = isLight ? "#475569" : "#D4D4D8";
  const textMuted = isLight ? "#64748B" : "#71717A";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Real-time validations
  const [emailError, setEmailError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Invalid email format");
    } else {
      setEmailError("");
    }
  }, [email]);

  useEffect(() => {
    if (password) {
      if (password.length < 6) {
        setPasswordStrength("Weak (min 6 characters)");
      } else if (password.length < 10) {
        setPasswordStrength("Medium");
      } else {
        setPasswordStrength("Strong");
      }
    } else {
      setPasswordStrength("");
    }
  }, [password]);

  useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setMatchError("Passwords do not match");
    } else {
      setMatchError("");
    }
  }, [password, confirmPassword]);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      notify("Error", "Please fill in all fields.");
      return;
    }
    if (emailError || matchError) {
      notify("Error", "Please fix the form errors.");
      return;
    }
    if (!acceptedTerms) {
      notify("Error", "Please accept the terms and conditions.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      // With email confirmation on, there is no session yet — wait for the link.
      // With it off, Supabase returns a session and the navigator switches itself.
      if (!data.session) navigation.replace("EmailVerificationPending", { email: email.trim() });
    } catch (e: any) {
      notify("Sign up failed", e?.message ?? "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} className="px-6 py-8">
        
        {/* Header Visual Emblems & Titles */}
        <View className="mb-6">
          <View className="flex-row items-center space-x-3 mb-4">
            <View style={{ backgroundColor: bgInput }} className="w-12 h-12 rounded-2xl items-center justify-center shadow-md mr-3 border border-slate-200/50">
              <Icon name="ghost" size={22} color="#C084FC" />
            </View>
            <View style={{ backgroundColor: bgInput }} className="w-12 h-12 rounded-2xl items-center justify-center shadow-md mr-3 border border-slate-200/50">
              <Icon name="puzzle" size={22} color="#38BDF8" />
            </View>
            <View style={{ backgroundColor: bgInput }} className="w-12 h-12 rounded-2xl items-center justify-center shadow-md border border-slate-200/50">
              <Icon name="zap" size={22} color="#F59E0B" />
            </View>
          </View>

          <Text style={{ color: textPrimary }} className="text-3xl font-extrabold text-left mb-2 font-sans">
            Create Account
          </Text>
          
          <Text style={{ color: textSecondary }} className="text-sm text-left leading-6">
            Join Retro Code and build apps by describing them, from your phone.
          </Text>
        </View>

        {/* Form Inputs */}
        <View className="space-y-4">
          <View className="mb-3">
            <Text style={{ color: textPrimary }} className="text-sm font-bold text-left mb-2">Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="developer@retrocode.dev"
              placeholderTextColor={textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              className="w-full p-4 rounded-2xl text-base text-left border border-slate-200/50"
              style={{ backgroundColor: bgInput, color: textPrimary }}
            />
            {emailError ? (
              <Text className="text-red-500 text-xs text-left mt-1.5">{emailError}</Text>
            ) : null}
          </View>

          <View className="mb-3">
            <Text style={{ color: textPrimary }} className="text-sm font-bold text-left mb-2">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={textMuted}
              secureTextEntry
              autoCapitalize="none"
              className="w-full p-4 rounded-2xl text-base text-left border border-slate-200/50"
              style={{ backgroundColor: bgInput, color: textPrimary }}
            />
            {passwordStrength ? (
              <Text className={`text-xs text-left mt-1.5 font-bold ${
                passwordStrength.includes("Weak") ? "text-red-500" : passwordStrength === "Medium" ? "text-amber-500" : "text-emerald-500"
              }`}>
                Strength: {passwordStrength}
              </Text>
            ) : null}
          </View>

          <View className="mb-4">
            <Text style={{ color: textPrimary }} className="text-sm font-bold text-left mb-2">Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={textMuted}
              secureTextEntry
              autoCapitalize="none"
              className="w-full p-4 rounded-2xl text-base text-left border border-slate-200/50"
              style={{ backgroundColor: bgInput, color: textPrimary }}
            />
            {matchError ? (
              <Text className="text-red-500 text-xs text-left mt-1.5">{matchError}</Text>
            ) : null}
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.8}
            className="flex-row items-center justify-start py-2 mb-2"
          >
            <View className={`w-5 h-5 rounded-md border items-center justify-center mr-3 ${
              acceptedTerms ? "bg-[#6D42C7] border-purple-500" : (isLight ? "bg-[#F1F5F9] border-slate-300" : "bg-[#141414] border-zinc-700")
            }`}>
              {acceptedTerms && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text style={{ color: textSecondary }} className="text-xs text-left font-medium">
              I accept the Terms of Service & Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
            className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
          >
            <Text className="text-white text-base font-bold tracking-wide">
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Link */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          className="items-center mt-6 py-2"
        >
          <Text style={{ color: textSecondary }} className="text-sm font-semibold">
            Already have an account? <Text className="text-purple-500 font-extrabold underline">Sign In</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};
