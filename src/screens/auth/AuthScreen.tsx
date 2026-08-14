/**
 * frontend/src/screens/auth/AuthScreen.tsx
 * ---------------------------------------------------------------------------
 * Padded, minimal login and registration screen.
 * Uses clean UI typography, raised surfaces, and terracotta brand colors.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, Alert, ActivityIndicator, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeProvider";
import { supabase } from "../../services/supabase";

export const AuthScreen = () => {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("خطا", "لطفاً ایمیل و رمز عبور را وارد کنید.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("ثبت‌نام موفقیت‌آمیز", "ایمیل تایید برای شما ارسال شد (یا حساب مستقیماً ساخته شد).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert("خطای ورود/ثبت‌نام", error.message || "عملیات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "apple") => {
    Alert.alert("ورود سریع", `اتصال به ${provider === "google" ? "گوگل" : "اپل"} در محیط توسعه شبیه‌سازی شده است.`);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} className="px-6 py-8">
          {/* Logo / Header */}
          <View className="items-center mb-8">
            <Text variant="h1" className="font-uiSemiBold tracking-tight">
              issac
            </Text>
            <Text variant="caption" className="mt-1 text-center opacity-80">
              دستیار هوشمند برنامه‌نویسی موبایل (Mobile Coding Agent)
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text variant="caption" className="mb-1.5 font-uiMedium uppercase">
                ایمیل (Email)
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={colors.inkSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
              />
            </View>

            <View className="mt-3">
              <Text variant="caption" className="mb-1.5 font-uiMedium uppercase">
                رمز عبور (Password)
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.inkSecondary}
                secureTextEntry
                autoCapitalize="none"
                className="w-full bg-surfaceRaised p-3.5 rounded-input border border-borderHairline font-uiRegular text-sm text-left"
                style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline, color: colors.inkPrimary }}
              />
            </View>

            {/* Action Button */}
            <Button
              label={isSignUp ? "ثبت‌نام (Create Account)" : "ورود (Sign In)"}
              onPress={handleAuth}
              loading={loading}
              className="mt-6"
            />
          </View>

          {/* Toggle Link */}
          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            className="items-center mt-4 py-2"
          >
            <Text variant="caption" className="text-brandPrimary font-uiMedium" style={{ color: colors.brandPrimary }}>
              {isSignUp ? "حساب کاربری دارید؟ وارد شوید" : "حساب کاربری ندارید؟ ثبت‌نام کنید"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-[1px] bg-borderHairline" style={{ backgroundColor: colors.borderHairline }} />
            <Text variant="caption" className="mx-3 opacity-60">یا (Or)</Text>
            <View className="flex-1 h-[1px] bg-borderHairline" style={{ backgroundColor: colors.borderHairline }} />
          </View>

          {/* Social Logins (Google & Apple - Mandatory for Apple Store review) */}
          <View className="flex-row space-x-3 justify-center">
            {/* Apple login */}
            <TouchableOpacity
              onPress={() => handleSocialLogin("apple")}
              className="flex-row items-center justify-center bg-surfaceRaised border border-borderHairline rounded-pill py-3 px-6 flex-1 mr-2"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
            >
              <Text variant="body" className="font-uiMedium text-inkPrimary">
                 Apple
              </Text>
            </TouchableOpacity>

            {/* Google login */}
            <TouchableOpacity
              onPress={() => handleSocialLogin("google")}
              className="flex-row items-center justify-center bg-surfaceRaised border border-borderHairline rounded-pill py-3 px-6 flex-1 ml-2"
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
            >
              <Text variant="body" className="font-uiMedium text-inkPrimary">
                G Google
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
