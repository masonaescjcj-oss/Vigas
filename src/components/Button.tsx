/**
 * frontend/src/components/Button.tsx
 * ---------------------------------------------------------------------------
 * A key.
 *
 * Every button is drawn as a physical key: a surface with a darker lip along
 * its bottom edge, so it stands up from the body it sits on. Four tones cover
 * every case the screens have:
 *
 *   primary   the one action on the screen — the signal colour, like the "="
 *             key on a calculator
 *   neutral   everything else that does something
 *   ghost     a text action with no key under it — cancel, skip, back
 *   danger    destructive — a soft red key, so it is not the loudest thing
 *
 * Two sizes. A full-size key is squared-off (16px corners) and 52px tall, a
 * comfortable thumb target; a small one is a round-ended pill for rows of
 * actions. Every tap gives light haptic feedback, because on a phone that is
 * the difference between a button and a picture of one.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { TouchableOpacity, ActivityIndicator, View, type TouchableOpacityProps } from "react-native";
import { Text } from "./Typography";
import { Icon } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { keyEdge } from "../theme/device";
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
    primary: { bg: colors.brandPrimary, fg: colors.canvasBase, edge: colors.brandEdge },
    neutral: { bg: colors.surfaceMuted, fg: colors.inkPrimary, edge: colors.capEdge },
    ghost: { bg: "transparent", fg: colors.inkSecondary, edge: null },
    danger: { bg: colors.failedSoft, fg: colors.failed, edge: colors.capEdge },
  }[resolved];

  const off = disabled || loading;
  const small = size === "sm";

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center ${block ? "w-full" : "self-start"} ${className}`}
      disabled={off}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: loading }}
      onPress={(e) => {
        if (off) return;
        tapFeedback();
        onPress?.(e);
      }}
      style={[
        {
          backgroundColor: palette.bg,
          minHeight: small ? 38 : 52,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: small ? 999 : 16,
          opacity: off && !loading ? 0.45 : 1,
        },
        palette.edge ? keyEdge(palette.edge, small ? 2 : 3) : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View className="flex-row items-center">
          {icon ? <Icon name={icon} size={small ? 14 : 17} color={palette.fg} style={{ marginRight: 8 }} /> : null}
          <Text
            variant="body"
            className={resolved === "primary" ? "font-uiSemiBold" : "font-uiMedium"}
            style={{ color: palette.fg, fontSize: small ? 13.5 : 16, lineHeight: small ? 18 : 21 }}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
