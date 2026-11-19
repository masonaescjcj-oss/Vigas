/**
 * components/ui/Input.tsx
 * ---------------------------------------------------------------------------
 * A labelled text field, drawn as a well sunk into the body.
 *
 * The label is the mono legend above it, lowercase, like the printing beside a
 * socket on a panel. Focus is the signal colour on the rim and nothing else.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, type TextInputProps } from "react-native";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { fontFamilyFor } from "../../theme/fonts";
import { directionStyleFor } from "../../theme/direction";
import { wellShadow } from "../../theme/device";

interface InputProps extends TextInputProps {
  label?: string;
  /** Shown under the field in red; replaces the hint while present. */
  error?: string | null;
  /** Shown under the field, muted. */
  hint?: string;
  /** Something to the right of the label — a "forgot?" link, a counter. */
  trailing?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  trailing,
  style,
  value,
  onFocus,
  onBlur,
  ...props
}) => {
  const { colors, mode } = useTheme();
  const [focused, setFocused] = useState(false);

  const border = error ? colors.failed : focused ? colors.brandPrimary : "transparent";
  const text = typeof value === "string" ? value : "";

  return (
    <View className="mb-4">
      {label || trailing ? (
        <View className="flex-row items-center justify-between mb-2">
          {label ? <Text variant="label">{label}</Text> : <View />}
          {trailing ?? null}
        </View>
      ) : null}

      <TextInput
        value={value}
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          {
            minHeight: 52,
            paddingHorizontal: 16,
            borderRadius: 14,
            fontSize: 16,
            backgroundColor: colors.surfaceCode,
            borderWidth: 1,
            borderColor: border,
            color: colors.inkPrimary,
            // Persian is set in the device face and runs the right way as it
            // is typed, not after it is submitted.
            fontFamily: fontFamilyFor(text),
            ...directionStyleFor(text),
            outlineStyle: "none",
            outlineWidth: 0,
          } as object,
          wellShadow(mode),
          style,
        ]}
        {...props}
      />

      {error ? (
        <Text variant="caption" className="mt-1.5" style={{ color: colors.failed }}>{error}</Text>
      ) : hint ? (
        <Text variant="caption" className="mt-1.5" style={{ color: colors.inkMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
};
