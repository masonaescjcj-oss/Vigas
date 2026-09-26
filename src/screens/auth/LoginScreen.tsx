/**
 * frontend/src/screens/auth/LoginScreen.tsx
 * ---------------------------------------------------------------------------
 * Email, password, in.
 *
 * It opened with two decorative tiles — a ghost icon and a ⚡ emoji — over an
 * extrabold "Welcome Back", then two hand-styled inputs with a Tailwind grey
 * border and a purple "Forgot Password?" link. None of that helped anyone sign
 * in. A title, two fields, one button.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { notify } from "../../services/notify";
import { supabase } from "../../services/supabase";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

export const LoginScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      notify("Missing details", "Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // On success AppNavigator's onAuthStateChange listener swaps the stack.
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not sign you in. Check your email and password.";
      notify("Sign in failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvasBase }}>
      <ScreenHeader title="" divider={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 mt-2">
            <Text variant="h1" style={{ fontSize: 40, lineHeight: 42, letterSpacing: -1.6 }}>Welcome back.</Text>
            <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
              Your projects and chats are where you left them.
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void handleLogin()}
            trailing={
              <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} hitSlop={8}>
                <Text variant="label" style={{ color: colors.brandPrimary }}>forgot?</Text>
              </TouchableOpacity>
            }
          />

          <Button label="Sign in" block loading={loading} onPress={() => void handleLogin()} className="mt-2" />

          <TouchableOpacity
            onPress={() => navigation.navigate("SignUp")}
            className="items-center mt-8 py-2"
            activeOpacity={0.6}
          >
            <Text variant="body" style={{ color: colors.inkSecondary }}>
              No account yet?{" "}
              <Text variant="body" className="font-uiMedium" style={{ color: colors.brandPrimary }}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
