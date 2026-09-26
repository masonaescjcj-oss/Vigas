/**
 * components/ui/Toggle.tsx
 * ---------------------------------------------------------------------------
 * An on/off switch drawn as a slide switch: a well for the track, a knob that
 * travels. On is the signal colour.
 *
 * The platform Switch was drawn differently on iOS, Android and the web, and
 * on the web it was a blue checkbox-ish pill that belonged to no one.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { wellShadow } from "../../theme/device";
import { selectionFeedback } from "../../services/haptics";

interface ToggleProps {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ value, onValueChange, accessibilityLabel, disabled }) => {
  const { colors, mode } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => { selectionFeedback(); onValueChange?.(!value); }}
      style={[
        { width: 46, height: 28, borderRadius: 14, justifyContent: "center", opacity: disabled ? 0.45 : 1 },
        value ? { backgroundColor: colors.brandPrimary } : [{ backgroundColor: colors.surfaceCode }, wellShadow(mode)],
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          marginLeft: value ? 21 : 3,
          backgroundColor: value ? colors.canvasBase : colors.surfaceStrong,
        }}
      />
    </Pressable>
  );
};
