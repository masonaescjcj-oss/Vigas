/**
 * components/ui/Input.tsx
 * ---------------------------------------------------------------------------
 * A labelled text field.
 *
 * Five auth screens and three settings screens each typed out the same block:
 * a bold label, a TextInput with `border-slate-200/50` (a Tailwind grey that is
 * not in the palette), an error line in `text-red-500` (also not). Same field,
 * eight slightly different looks. This is the field, once.
 *
 * The label is quiet, not bold — the value is what the eye should land on.
 * Focus is the brand colour on the border and nothing else; no glow, no shadow.
 * ---------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { View, TextInput, type TextInputProps } from "react-native";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { fontFamilyFor } from "../../theme/fonts";
import { directionStyleFor } from "../../theme/direction";

interface InputProps extends TextInputProps {
  label?: string;
  /** Shown under the field in red; replaces the hint while present. */
  error?: string | null;
  /** Shown under the field, muted. */
  hint?: string;
  /** Something to the right of the label — a "Forgot?" link, a counter. */
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
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const border = error ? colors.failed : focused ? colors.brandPrimary : colors.borderHairline;
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
        className="rounded-input px-4 text-base"
        style={[
          {
            minHeight: 48,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: border,
            color: colors.inkPrimary,
            // Persian is set in its own face and runs the right way as it is
            // typed, not after it is submitted.
            fontFamily: fontFamilyFor(text),
            ...directionStyleFor(text),
            outlineStyle: "none",
            outlineWidth: 0,
          } as object,
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
