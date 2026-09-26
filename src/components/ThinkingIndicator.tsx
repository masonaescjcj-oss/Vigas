/**
 * frontend/src/components/ThinkingIndicator.tsx
 * ---------------------------------------------------------------------------
 * What the app shows while it is working.
 *
 * A pulsing mark and one line of text, aligned with the answer that will
 * replace it — so when the answer arrives nothing jumps. The label says what is
 * actually happening (asking the model, or which tool is running) rather than a
 * generic spinner, because "Thinking…" for thirty seconds is indistinguishable
 * from being stuck.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { glow } from "../theme/device";

interface ThinkingIndicatorProps {
  /** e.g. "Thinking", "Running write", "Reading files". */
  label: string;
  /** Optional second line: the current step, a file name, an elapsed time. */
  detail?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ label, detail }) => {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] });

  return (
    <View className="flex-row items-center py-2">
      {/* A square LED in the signal colour, pulsing: the device is working.
          Square rather than a sparkle, because a sparkle promises magic and
          this is a machine running steps. */}
      <Animated.View
        style={[
          { width: 8, height: 8, borderRadius: 2, backgroundColor: colors.brandPrimary, marginRight: 12, opacity, transform: [{ scale }] },
          glow(colors.brandPrimary, 10),
        ]}
      />
      <View className="flex-1">
        <Text variant="body" className="font-uiMedium" style={{ fontSize: 14, lineHeight: 19 }}>
          {label}
        </Text>
        {detail ? (
          <Text variant="label" numberOfLines={1} style={{ fontSize: 11, textTransform: "none", marginTop: 1 }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
