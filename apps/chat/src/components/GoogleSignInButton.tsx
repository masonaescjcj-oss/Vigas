/**
 * frontend/src/components/GoogleSignInButton.tsx
 * ---------------------------------------------------------------------------
 * "Continue with Google": a neutral key with Google's own mark, as Google's
 * sign-in branding asks, and the line saying what continuing agrees to — the
 * sign-up form has a checkbox for that, and this path skips the form.
 *
 * The flow itself is services/googleAuth.ts.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "./Button";
import { Text } from "./Typography";
import { notify } from "../services/notify";
import { signInWithGoogle } from "../services/googleAuth";
import { useTheme } from "../theme/ThemeProvider";

/** Google's four-colour G, as published for sign-in buttons. */
const GoogleMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

export const GoogleSignInButton: React.FC<{ label?: string }> = ({ label = "Continue with Google" }) => {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  // Signing in swaps the whole navigator, so this can unmount mid-flow.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const handlePress = async () => {
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === "failed") notify("Couldn't sign in with Google", result.message);
      // On web the page is leaving for Google; keep the spinner until it does.
      if (result.status !== "redirecting" && mounted.current) setBusy(false);
    } catch (e: any) {
      notify("Couldn't sign in with Google", e?.message ?? "Please try again.");
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Button label={label} tone="neutral" block loading={busy} leading={<GoogleMark />} onPress={() => void handlePress()} />
      <Text variant="caption" className="text-center" style={{ color: colors.inkMuted, fontSize: 12, lineHeight: 17 }}>
        Continuing with Google accepts the Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
};
