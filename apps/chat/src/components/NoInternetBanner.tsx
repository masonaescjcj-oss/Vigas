/**
 * frontend/src/components/NoInternetBanner.tsx
 * ---------------------------------------------------------------------------
 * The banner shown when the app cannot reach its backend.
 *
 * It used to be permanently mounted and slid off-screen with an animated
 * translateY. Two things were wrong with that, both found by testing the offline
 * path rather than reading the code:
 *
 *   1. Visibility depended on an animation. Animated needs requestAnimationFrame,
 *      and rAF does not run in a backgrounded or non-compositing page — so the
 *      state could say "offline" while the banner stayed parked off-screen. An
 *      error indicator must not be defeatable by a throttled timer.
 *   2. The text was in the document at all times. Off-screen is not hidden to a
 *      screen reader, so it announced "No internet connection" permanently.
 *
 * So visibility is now a render decision. Nothing is mounted while things work.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export const NoInternetBanner = () => {
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        backgroundColor: colors.failed,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        flexDirection: "row",
        paddingHorizontal: 16,
      }}
    >
      <Text
        className="text-xs font-bold tracking-wide"
        // Always light: the background is the error red in every theme, and
        // inkPrimary is dark in the light theme — dark on red is barely readable.
        style={{ color: "#FFFFFF" }}
      >
        {/* What is actually known is that our server did not answer. The user's
            internet may be fine, and telling them it is not sends them to fix
            the wrong thing. */}
        Can't reach Vigas — retrying
      </Text>
    </View>
  );
};
