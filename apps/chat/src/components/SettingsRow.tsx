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
import { View, TouchableOpacity } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Typography";
import { Toggle } from "./ui/Toggle";
import { useTheme } from "../theme/ThemeProvider";
import { selectionFeedback } from "../services/haptics";

interface SettingsRowProps {
  label: string;
  /** One line under the label, for what the row does or its current state. */
  hint?: string;
  icon?: string;
  /** A short value shown before the chevron, e.g. "Black" on a theme row. */
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
        minHeight: 56,
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
          // The legend under a control: mono, as the rest of the panel's is.
          <Text variant="label" style={{ marginTop: 2, fontSize: 11.5 }}>{hint}</Text>
        ) : null}
      </View>

      {hasSwitch ? (
        <Toggle value={switchValue} onValueChange={onSwitchChange} accessibilityLabel={label} />
      ) : (
        <View className="flex-row items-center">
          {value ? (
            <Text variant="label" style={{ marginRight: 6, textTransform: "none" }}>{value}</Text>
          ) : null}
          {onPress ? <Icon name="chevron-right" size={16} color={colors.inkMuted} /> : null}
        </View>
      )}
    </View>
  );

  if (hasSwitch || !onPress) return content;

  return (
    <TouchableOpacity onPress={() => { selectionFeedback(); onPress(); }} activeOpacity={0.6} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
};
