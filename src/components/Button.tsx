/**
 * frontend/src/components/Button.tsx
 * ---------------------------------------------------------------------------
 * The one button.
 *
 * Seventy-one TouchableOpacity elements were hand-styled in the chat screen
 * alone, each with its own padding, radius, shadow and colour pair. This is
 * the shape they all wanted. Four tones cover every case the screens have:
 *
 *   primary   the one action on the screen — brand fill
 *   neutral   everything else that does something — muted surface
 *   ghost     a text action, no fill — cancel, skip, back
 *   danger    destructive — soft red fill so it is not the loudest thing
 *
 * No shadows. A pressed state is opacity, not elevation. Every tap gives light
 * haptic feedback, because on a phone that is the difference between a button
 * and a picture of one.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { TouchableOpacity, ActivityIndicator, View, type TouchableOpacityProps } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { tapFeedback } from "../services/haptics";

export type ButtonTone = "primary" | "neutral" | "ghost" | "danger";

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  tone?: ButtonTone;
  /** Kept for the screens that still pass it; maps onto tone. */
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
  icon?: string;
  loading?: boolean;
  /** Stretch to the container. Default is content width, which is what a row of actions wants. */
  block?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  tone,
  variant,
  size = "md",
  icon,
  loading = false,
  block = false,
  className = "",
  style,
  disabled,
  onPress,
  ...props
}) => {
  const { colors } = useTheme();
  const resolved: ButtonTone = tone ?? (variant === "secondary" ? "neutral" : "primary");

  const palette = {
    primary: { bg: colors.brandPrimary, fg: colors.canvasBase, border: "transparent" },
    neutral: { bg: colors.surfaceMuted, fg: colors.inkPrimary, border: "transparent" },
    ghost: { bg: "transparent", fg: colors.inkSecondary, border: "transparent" },
    danger: { bg: colors.failedSoft, fg: colors.failed, border: "transparent" },
  }[resolved];

  const pad = size === "sm" ? "px-3.5 py-2" : "px-5 py-3";
  const off = disabled || loading;

  return (
    <TouchableOpacity
      className={`${pad} rounded-pill flex-row items-center justify-center ${block ? "w-full" : "self-start"} ${className}`}
      disabled={off}
      activeOpacity={0.7}
      onPress={(e) => {
        if (off) return;
        tapFeedback();
        onPress?.(e);
      }}
      style={[{ backgroundColor: palette.bg, opacity: off ? 0.5 : 1 }, style]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View className="flex-row items-center">
          {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} color={palette.fg} style={{ marginRight: 8 }} /> : null}
          <Text
            variant="body"
            className={size === "sm" ? "font-uiMedium text-xs" : "font-uiMedium"}
            style={{ color: palette.fg }}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
