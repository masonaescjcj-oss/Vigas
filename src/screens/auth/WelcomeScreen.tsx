/**
 * frontend/src/screens/auth/WelcomeScreen.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) WELCOME & AUTHENTICATION LANDING SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 * 
 * DEVELOPER LOGIC & FLOW:
 * 1. GUEST MODE AUTHENTICATION:
 *    Generates an instant anonymous session via `setSession` without requiring email.
 * 2. SKILLS.SH ECOSYSTEM BLUEPRINT:
 *    Highlights open-source agent skills, UI design rules, and test generators.
 * ============================================================================
 */

import React from "react";
import { View, SafeAreaView, TouchableOpacity, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { type AuthStackParamList } from "../../navigation/types";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../theme/store";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { setSession } = useAuthStore();
  const { mode } = useThemeStore();

  const isLight = mode === "light";
  const bgCanvas = isLight ? "#FFFFFF" : "#000000";
  const bgCard = isLight ? "#F8FAFC" : "#141416";
  const bgItem = isLight ? "#F1F5F9" : "#1A1A1E";
  const bgButton = isLight ? "#F1F5F9" : "#141414";
  const textPrimary = isLight ? "#0F172A" : "#FFFFFF";
  const textSecondary = isLight ? "#475569" : "#A1A1AA";
  const textMuted = isLight ? "#64748B" : "#71717A";

  const runGuestLogin = async () => {
    const mockSession = {
      access_token: "guest_token_retrocode",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "guest_refresh",
      user: {
        id: "guest-user-uuid",
        app_metadata: {},
        user_metadata: { full_name: "Retro Code Guest" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
        email: "guest@retrocode.dev",
      },
    };
    void setSession(mockSession as any);
  };

  const handleGuestMode = () => {
    if (Platform.OS === "web") {
      const confirm = window.confirm("Guest login provides immediate access to Retro Code IDE. Continue as Guest?");
      if (confirm) {
        void runGuestLogin();
      }
    } else {
      Alert.alert(
        "Guest Mode",
        "Guest mode provides immediate access to Retro Code IDE. Continue as Guest?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: runGuestLogin }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1 justify-between px-6 py-8">
      
      {/* Top Brand Header & Skills.sh Hero Showcase */}
      <View className="items-center mt-4">
        
        {/* Sleek Brand Title (Matching Watermark Style) */}
        <View className="flex-row items-baseline justify-center mb-1">
          <Text 
            style={{ 
              fontSize: 32, 
              fontWeight: isLight ? "600" : "300", 
              color: textPrimary, 
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif",
              letterSpacing: -1
            } as any}
          >
            retro code
          </Text>
          <Text 
            style={{ 
              fontSize: 24, 
              fontWeight: "600", 
              color: "#C084FC", 
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, sans-serif",
              marginLeft: 8,
              letterSpacing: -0.5
            } as any}
          >
            pro
          </Text>
        </View>

        <Text style={{ color: textMuted }} className="text-xs font-semibold tracking-wider uppercase mb-6 font-mono">
          AI AGENT CODING & BUILDER SPACE
        </Text>

        {/* Upgraded Skills.sh Ecosystem Glassmorphism Feature Card */}
        <View style={{ backgroundColor: bgCard, borderColor: isLight ? "#E2E8F0" : "rgba(168, 85, 247, 0.2)" }} className="border p-5 rounded-3xl w-full shadow-xl relative overflow-hidden">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-10 h-10 rounded-2xl bg-purple-950/40 items-center justify-center mr-3 border border-purple-500/30">
                <Text className="text-xl">🧩</Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: textPrimary }} className="text-base font-bold text-left">Skills.sh Ecosystem</Text>
                <Text className="text-purple-500 text-xs text-left">1,000+ Open Source Agent Skills</Text>
              </View>
            </View>

            <View className="bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full">
              <Text className="text-purple-200 text-[10px] font-mono font-bold uppercase tracking-wide">Featured #1</Text>
            </View>
          </View>

          {/* Feature Badges Grid */}
          <View className="space-y-2 pt-1">
            <View style={{ backgroundColor: bgItem }} className="flex-row items-center px-3 py-2 rounded-xl">
              <Text className="text-purple-500 text-xs mr-2.5">✦</Text>
              <Text style={{ color: textPrimary }} className="text-xs text-left font-medium">UI Design Rules & Vector Icon Mastery</Text>
            </View>

            <View style={{ backgroundColor: bgItem }} className="flex-row items-center px-3 py-2 rounded-xl">
              <Text className="text-sky-500 text-xs mr-2.5">✦</Text>
              <Text style={{ color: textPrimary }} className="text-xs text-left font-medium">React Native & Expo Performance Tuning</Text>
            </View>

            <View style={{ backgroundColor: bgItem }} className="flex-row items-center px-3 py-2 rounded-xl">
              <Text className="text-emerald-500 text-xs mr-2.5">✦</Text>
              <Text style={{ color: textPrimary }} className="text-xs text-left font-medium">Automated Jest & Playwright Test Generators</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="space-y-3 mb-4">
        
        {/* Sign In Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          className="w-full py-4 bg-[#6D42C7] rounded-2xl items-center justify-center active:opacity-90 shadow-xl mb-3"
        >
          <Text className="text-white text-base font-bold tracking-wide">Sign In to Retro Code</Text>
        </TouchableOpacity>

        {/* Create Account Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SignUp")}
          style={{ backgroundColor: bgButton, borderColor: isLight ? "#E2E8F0" : "transparent" }}
          className="w-full py-4 border rounded-2xl items-center justify-center active:opacity-80 mb-3 shadow-sm"
        >
          <Text style={{ color: textPrimary }} className="text-base font-semibold">Create New Account</Text>
        </TouchableOpacity>

        {/* Social Options */}
        <View className="flex-row space-x-3 mt-1 mb-2">
          <TouchableOpacity
            onPress={() => Alert.alert("Apple Authentication", "Apple Login Triggered")}
            style={{ backgroundColor: bgButton, borderColor: isLight ? "#E2E8F0" : "transparent" }}
            className="flex-row items-center justify-center border rounded-2xl py-3.5 px-4 flex-1 mr-2 active:opacity-80 shadow-sm"
          >
            <Text style={{ color: textPrimary }} className="text-sm font-medium"> Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Google Authentication", "Google Login Triggered")}
            style={{ backgroundColor: bgButton, borderColor: isLight ? "#E2E8F0" : "transparent" }}
            className="flex-row items-center justify-center border rounded-2xl py-3.5 px-4 flex-1 ml-2 active:opacity-80 shadow-sm"
          >
            <Text style={{ color: textPrimary }} className="text-sm font-medium">G Google</Text>
          </TouchableOpacity>
        </View>

        {/* Guest Mode Option */}
        <TouchableOpacity 
          onPress={handleGuestMode}
          className="items-center py-2"
        >
          <Text style={{ color: textSecondary }} className="text-xs font-semibold underline">
            Continue as Guest (Instant IDE Access)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
