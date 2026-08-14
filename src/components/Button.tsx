/**
 * frontend/src/components/Button.tsx
 * ---------------------------------------------------------------------------
 * Primary and Secondary buttons styled with pill shapes and UI clean typography.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { TouchableOpacity, ActivityIndicator, type TouchableOpacityProps } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = "primary",
  loading = false,
  className = "",
  style,
  disabled,
  ...props
}) => {
  const { colors } = useTheme();

  const isPrimary = variant === "primary";

  // Base container class (always pill shaped)
  const containerClass = isPrimary
    ? "bg-brandPrimary py-3 px-6 rounded-pill items-center justify-center"
    : "bg-transparent py-3 px-6 rounded-pill border border-borderHairline items-center justify-center";

  // Label color class
  const textClass = isPrimary ? "text-canvasBase font-uiMedium" : "text-inkPrimary font-uiMedium";

  return (
    <TouchableOpacity
      className={`${containerClass} ${disabled || loading ? "opacity-60" : ""} ${className}`}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        isPrimary ? { backgroundColor: colors.brandPrimary } : { borderColor: colors.borderHairline },
        style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.canvasBase : colors.inkPrimary} size="small" />
      ) : (
        <Text variant="body" className={textClass} style={{ color: isPrimary ? colors.canvasBase : colors.inkPrimary }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};
