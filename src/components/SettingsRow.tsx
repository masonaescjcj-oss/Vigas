/**
 * frontend/src/components/SettingsRow.tsx
 * ---------------------------------------------------------------------------
 * Reusable row item for Settings panels:
 *   - Customizable left side elements (Switch toggle, chevron arrows, or values).
 *   - Icon and label.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity, Switch } from "react-native";
import { Icon } from "../components/Icon";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface SettingsRowProps {
  label: string;
  icon?: string;
  value?: string;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  icon,
  value,
  hasSwitch = false,
  switchValue = false,
  onSwitchChange,
  onPress,
}) => {
  const { colors } = useTheme();

  const RowContent = (
    <View 
      className="flex-row items-center justify-between py-4 border-b border-borderHairline/20"
      style={{ borderBottomColor: colors.borderHairline }}
    >
      {/* Left side element */}
      <View className="flex-row items-center">
        {hasSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.surfaceCode, true: colors.brandPrimary }}
            thumbColor={colors.surfaceRaised}
          />
        ) : value ? (
          <View className="flex-row items-center">
            <Text variant="caption" className="opacity-70 mr-1">{value}</Text>
            <Text variant="caption" className="opacity-40">◀</Text>
          </View>
        ) : (
          <Text variant="caption" className="opacity-40">◀</Text>
        )}
      </View>

      {/* Right side element */}
      <View className="flex-row items-center">
        <Text variant="body" className="font-uiMedium mr-3">
          {label}
        </Text>
        {icon && (
          <Icon name={icon} size={17} color={colors.inkSecondary} />
        )}
      </View>
    </View>
  );

  if (hasSwitch) {
    return <View className="px-4">{RowContent}</View>;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="px-4">
      {RowContent}
    </TouchableOpacity>
  );
};
