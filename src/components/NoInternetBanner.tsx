/**
 * frontend/src/components/NoInternetBanner.tsx
 * ============================================================================
 * PURE OBSIDIAN BLACK (#000000) OFFLINE NETWORK BANNER
 * BRAND: RETRO CODE & SKILLS.SH ECOSYSTEM
 * ============================================================================
 */

import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export const NoInternetBanner = () => {
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  // Slide down if disconnected, slide up if connected
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? -60 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isConnected, slideAnim]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        backgroundColor: "#EF4444",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        transform: [{ translateY: slideAnim }],
        flexDirection: "row",
        paddingHorizontal: 16,
      }}
    >
      <Text 
        className="text-white text-xs font-bold font-mono tracking-wide"
        style={{ color: "#FFFFFF" }}
      >
        No internet connection
      </Text>
    </Animated.View>
  );
};
