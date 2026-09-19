/**
 * frontend/src/screens/auth/SignUpScreen.tsx
 * ---------------------------------------------------------------------------
 * Email, password twice, agree, in.
 *
 * The validation is unchanged — it was fine. What changed is that the three
 * fields, the checkbox and the button are the app's own, so this screen and the
 * sign-in screen next to it are visibly the same product.
 *
 * Strength is a hint under the field in the field's own colours, not a red /
 * amber / emerald traffic light from Tailwind's defaults.
 * ---------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Input } from "../../components/ui/Input";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { notify } from "../../services/notify";
import { supabase } from "../../services/supabase";
import { selectionFeedback } from "../../services/haptics";
import { type AuthStackParamList } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "SignUp">;

export const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");
  const [matchError, setMatchError] = useState("");

  useEffect(() => {
    setEmailError(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "That does not look like an email address" : "");
  }, [email]);

  useEffect(() => {
    if (!password) setPasswordStrength("");
    else if (password.length < 6) setPasswordStrength("At least 6 characters");
    else if (password.length < 10) setPasswordStrength("Okay — longer is stronger");
    else setPasswordStrength("Strong");
  }, [password]);

  useEffect(() => {
    setMatchError(confirmPassword && password !== confirmPassword ? "Passwords do not match" : "");
  }, [password, confirmPassword]);

  const weak = password.length > 0 && password.length < 6;

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      notify("Missing details", "Fill in every field.");
      return;
    }
    if (emailError || matchError || weak) {
      notify("Check the form", "Fix the highlighted fields first.");
      return;
    }
    if (!acceptedTerms) {
      notify("One more thing", "Accept the terms to continue.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      // With email confirmation on there is no session yet, and the email
      // carries a six-digit code — so the next step is a field, not a wait.
      // With confirmation off Supabase returns a session and the navigator
      // switches itself.
      if (!data.session) {
        navigation.replace("VerifyCode", { email: email.trim(), purpose: "signup" });
      }
    } catch (e: unknown) {
      notify("Sign up failed", e instanceof Error ? e.message : "Could not create your account.");
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
            <Text variant="h1" className="font-uiSemiBold">Create an account</Text>
            <Text variant="body" className="mt-2" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
              Build apps by describing them.
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
            error={emailError || null}
            returnKeyType="next"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={weak ? passwordStrength : null}
            hint={!weak && passwordStrength ? passwordStrength : undefined}
            returnKeyType="next"
          />

          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Once more"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={matchError || null}
            returnKeyType="go"
            onSubmitEditing={() => void handleSignUp()}
          />

          {/* The checkbox is a real control with a real target size, not a
              16px square. Tapping the sentence toggles it too. */}
          <TouchableOpacity
            onPress={() => { selectionFeedback(); setAcceptedTerms(!acceptedTerms); }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            activeOpacity={0.7}
            className="flex-row items-center py-2 mb-4"
          >
            <View
              className="w-[22px] h-[22px] rounded-md items-center justify-center mr-3"
              style={{
                backgroundColor: acceptedTerms ? colors.brandPrimary : "transparent",
                borderWidth: 1.5,
                borderColor: acceptedTerms ? colors.brandPrimary : colors.inkMuted,
              }}
            >
              {acceptedTerms ? <Icon name="check" size={13} color={colors.canvasBase} /> : null}
            </View>
            <Text variant="body" className="flex-1" style={{ color: colors.inkSecondary, lineHeight: 20 }}>
              I accept the Terms of Service and Privacy Policy
            </Text>
          </TouchableOpacity>

          <Button label="Create account" block loading={loading} onPress={() => void handleSignUp()} />

          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            className="items-center mt-8 py-2"
            activeOpacity={0.6}
          >
            <Text variant="body" style={{ color: colors.inkSecondary }}>
              Already have an account?{" "}
              <Text variant="body" className="font-uiMedium" style={{ color: colors.brandPrimary }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
