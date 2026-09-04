/**
 * frontend/src/components/SettingsRow.tsx
 * ---------------------------------------------------------------------------
 * One row in a settings list.
 *
 * The previous version was laid out right-to-left — chevron on the left, label
 * on the right — in an English-only interface, and drew the chevron as a
 * literal "◀" character that rendered in whatever glyph the platform happened
 * to have. Icon and label lead now; value, switch or chevron trail.
 *
 * Rows do not carry their own background. The list they sit in does, so ten
 * rows read as one surface with hairlines between them rather than ten cards.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity, Switch } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import { selectionFeedback } from "../services/haptics";

interface SettingsRowProps {
  label: string;
  /** One line under the label, for what the row does or its current state. */
  hint?: string;
  icon?: string;
  /** A short value shown before the chevron, e.g. "Darkest" on a theme row. */
  value?: string;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
  /** Red label and icon, for sign out and delete. */
  destructive?: boolean;
  /** No hairline under the last row of a group. */
  last?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  hint,
  icon,
  value,
  hasSwitch = false,
  switchValue = false,
  onSwitchChange,
  onPress,
  destructive = false,
  last = false,
}) => {
  const { colors } = useTheme();
  const ink = destructive ? colors.failed : colors.inkPrimary;

  const content = (
    <View
      className="flex-row items-center px-4"
      style={{
        minHeight: 52,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderHairline,
      }}
    >
      {icon ? (
        <Icon name={icon} size={18} color={destructive ? colors.failed : colors.inkSecondary} style={{ marginRight: 14 }} />
      ) : null}

      <View className="flex-1 py-3">
        <Text variant="body" style={{ color: ink }}>{label}</Text>
        {hint ? (
          <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>{hint}</Text>
        ) : null}
      </View>

      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={(v) => { selectionFeedback(); onSwitchChange?.(v); }}
          trackColor={{ false: colors.surfaceStrong, true: colors.brandPrimary }}
          thumbColor={colors.canvasBase}
        />
      ) : (
        <View className="flex-row items-center">
          {value ? (
            <Text variant="caption" className="mr-1.5" style={{ color: colors.inkMuted }}>{value}</Text>
          ) : null}
          {onPress ? <Icon name="chevron-right" size={16} color={colors.inkMuted} /> : null}
        </View>
      )}
    </View>
  );

  if (hasSwitch || !onPress) return content;

  return (
    <TouchableOpacity onPress={() => { selectionFeedback(); onPress(); }} activeOpacity={0.6}>
      {content}
    </TouchableOpacity>
  );
};
