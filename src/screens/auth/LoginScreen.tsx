/**
 * frontend/src/screens/auth/LoginScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) LOGIN SCREEN
 * BRAND: RETRO CODE
 * ============================================================================
 */

import React, { useState } from "react";
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

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

export const LoginScreen = () => {
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
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      notify("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // On success AppNavigator's onAuthStateChange listener swaps the stack.
    } catch (e: any) {
      notify("Sign in failed", e?.message ?? "Could not sign you in. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} className="px-6 py-8">
        
        {/* Header Visual Badge & Titles */}
        <View className="mb-8">
          <View className="flex-row items-center space-x-3 mb-4">
            <View style={{ backgroundColor: bgInput }} className="w-12 h-12 rounded-2xl items-center justify-center shadow-md mr-3 border border-slate-200/50">
              <Icon name="ghost" size={22} color="#C084FC" />
            </View>
            <View style={{ backgroundColor: bgInput }} className="w-12 h-12 rounded-2xl items-center justify-center shadow-md border border-slate-200/50">
              <Text className="text-2xl">⚡</Text>
            </View>
          </View>

          <Text style={{ color: textPrimary }} className="text-3xl font-extrabold text-left mb-2 font-sans">
            Welcome Back
          </Text>
          
          <Text style={{ color: textSecondary }} className="text-sm text-left leading-6">
            Sign in to manage your AI agent projects, models, and Skills.sh modules.
          </Text>
        </View>

        {/* Form Inputs */}
        <View className="space-y-4">
          <View className="mb-4">
            <Text style={{ color: textPrimary }} className="text-sm font-bold text-left mb-2">Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="developer@retrocode.dev"
              placeholderTextColor={textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              className="w-full p-4 rounded-2xl text-base text-left border border-slate-200/50"
              style={{ backgroundColor: bgInput, color: textPrimary, outlineStyle: "none", outlineWidth: 0 } as any}
            />
          </View>

          <View className="mb-6">
            <View className="flex-row justify-between mb-2">
              <Text style={{ color: textPrimary }} className="text-sm font-bold">Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
                <Text className="text-purple-500 text-xs font-bold">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={textMuted}
              secureTextEntry
              autoCapitalize="none"
              className="w-full p-4 rounded-2xl text-base text-left border border-slate-200/50"
              style={{ backgroundColor: bgInput, color: textPrimary, outlineStyle: "none", outlineWidth: 0 } as any}
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-xl"
          >
            <Text className="text-white text-base font-bold tracking-wide">
              {loading ? "Signing In..." : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Link */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SignUp")}
          className="items-center mt-8 py-2"
        >
          <Text style={{ color: textSecondary }} className="text-sm font-semibold">
            Don't have an account? <Text className="text-purple-500 font-extrabold underline">Create Account</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};
