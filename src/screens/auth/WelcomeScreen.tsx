/**
 * frontend/src/screens/auth/WelcomeScreen.tsx
 * ============================================================================
 * WELCOME & AUTHENTICATION LANDING SCREEN
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 * 
 * Sign in or create an account — those are the only two ways in.
 *
 * There was a third, "Continue as Guest", built on supabase.auth.signInAnonymously().
 * It was removed rather than fixed: it needs anonymous sign-ins enabled on the
 * project, and an account that cannot receive a password reset or be reached by
 * email is a dead end for the user's projects rather than a shortcut into them.
 * ============================================================================
 */

import React from "react";
import { View, SafeAreaView, TouchableOpacity } from "react-native";
import { Icon } from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { type AuthStackParamList } from "../../navigation/types";
import { useThemeStore } from "../../theme/store";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { mode } = useThemeStore();
  const { colors } = useTheme();

  const isLight = mode === "light";
  const bgCanvas = colors.canvasBase;
  const bgCard = colors.surfaceRaised;
  const bgItem = colors.surfaceMuted;
  const bgButton = colors.surfaceMuted;
  const textPrimary = colors.inkPrimary;
  const textSecondary = colors.inkSecondary;
  const textMuted = colors.inkSecondary;

  return (
    <SafeAreaView style={{ backgroundColor: bgCanvas }} className="flex-1 justify-between px-6 py-8">
      
      {/* Top Brand Header */}
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
              color: colors.brandPrimary, 
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

        {/* What the app actually does */}
        <View style={{ backgroundColor: bgCard, borderColor: colors.borderHairline }} className="border p-5 rounded-3xl w-full shadow-xl relative overflow-hidden">
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 rounded-2xl bg-purple-950/40 items-center justify-center mr-3 border border-purple-500/30">
              <Icon name="sparkles" size={20} color={colors.brandPrimary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: textPrimary }} className="text-base font-bold text-left">Build from your phone</Text>
              <Text className="text-purple-500 text-xs text-left">Describe it, the agent writes it</Text>
            </View>
          </View>

          <View className="space-y-2 pt-1">
            {[
              { icon: "layers", color: colors.brandPrimary, label: "Start from a template, or from scratch" },
              { icon: "eye", color: colors.brandPrimary, label: "Live preview on your device" },
              { icon: "folder", color: colors.success, label: "Your files, saved and versioned" },
            ].map((row) => (
              <View key={row.label} style={{ backgroundColor: bgItem }} className="flex-row items-center px-3 py-2 rounded-xl mb-2">
                <Icon name={row.icon} size={14} color={row.color} style={{ marginRight: 10 }} />
                <Text style={{ color: textPrimary }} className="text-xs text-left font-medium flex-1">{row.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="space-y-3 mb-4">
        
        {/* Sign In Button */}
        <TouchableOpacity style={{ backgroundColor: colors.brandPrimary }}
          onPress={() => navigation.navigate("Login")}
          className="w-full py-4 rounded-2xl items-center justify-center active:opacity-90 shadow-xl mb-3"
        >
          <Text className="text-white text-base font-bold tracking-wide">Sign In to Retro Code</Text>
        </TouchableOpacity>

        {/* Create Account Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SignUp")}
          style={{ backgroundColor: bgButton, borderColor: colors.borderHairline }}
          className="w-full py-4 border rounded-2xl items-center justify-center active:opacity-80 mb-3 shadow-sm"
        >
          <Text style={{ color: textPrimary }} className="text-base font-semibold">Create New Account</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};
