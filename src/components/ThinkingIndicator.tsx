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
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";

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
    <View className="flex-row items-start py-2">
      <Animated.View style={{ opacity, transform: [{ scale }], marginRight: 10, marginTop: 1 }}>
        <Icon name="sparkles" size={15} color={colors.brandPrimary} />
      </Animated.View>

      <View className="flex-1">
        <Animated.View style={{ opacity }}>
          <Text
            variant="body"
            className="text-left text-sm font-uiMedium"
            style={{ color: colors.inkPrimary }}
          >
            {label}
          </Text>
        </Animated.View>
        {detail ? (
          <Text
            variant="caption"
            className="text-left text-xs mt-0.5"
            style={{ color: colors.inkMuted }}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
