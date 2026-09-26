/**
 * frontend/src/screens/auth/ForgotPasswordScreen.tsx
 * ---------------------------------------------------------------------------
 * One field: the address to send the code to.
 *
 * The screen still carried a `sent` state and a "Reset Link Sent" card from
 * when the email held a link. It holds a code now and the next screen takes it,
 * so the card could never show. Gone, along with the ghost icon, the caps
 * wordmark and `text-zinc-400`.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types/navigation";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Input } from "../../components/ui/Input";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { notify } from "../../services/notify";
import { supabase } from "../../services/supabase";
import { useTheme } from "../../theme/ThemeProvider";

export const ForgotPasswordScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      notify("Missing details", "Enter the email address on your account.");
      return;
    }
    setLoading(true);
    try {
      // No redirectTo: the email carries a six-digit code, not a link, so
      // there is nowhere to come back to. The user types it on the next screen.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      navigation.navigate("VerifyCode", { email: email.trim(), purpose: "recovery" });
    } catch (e: unknown) {
      notify("Could not send the code", e instanceof Error ? e.message : "Check the address and try again.");
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
            <Text variant="h1" style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }}>Reset your password</Text>
            <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
              Enter your email and we will send a six-digit code.
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
            returnKeyType="go"
            onSubmitEditing={() => void handleReset()}
            autoFocus
          />

          <Button label="Send code" block loading={loading} onPress={() => void handleReset()} className="mt-2" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
