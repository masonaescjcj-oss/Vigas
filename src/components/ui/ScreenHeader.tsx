/**
 * components/ui/ScreenHeader.tsx
 * ---------------------------------------------------------------------------
 * The top of every pushed screen.
 *
 * Twenty-one screens drew their own: some put "← Back" on the left and the
 * title on the right, some the reverse, one centred the title and put the back
 * control after it. The arrow was a text character. None agreed on padding.
 * This is one shape — back on the left, title beside it, one optional action on
 * the right — so moving between screens feels like one app.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../Icon";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { selectionFeedback } from "../../services/haptics";

interface ScreenHeaderProps {
  title: string;
  /** One quiet line under the title — a count, a status, a path. */
  subtitle?: string;
  /** Hide the back control on a root screen. */
  noBack?: boolean;
  onBack?: () => void;
  /** One action, right-aligned. An icon alone renders as a round icon button. */
  action?: { label?: string; icon?: string; onPress: () => void };
  /** Hairline under the header. Off when the content starts with its own surface. */
  divider?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  noBack = false,
  onBack,
  action,
  divider = true,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const back = () => {
    selectionFeedback();
    if (onBack) onBack();
    else navigation.goBack();
  };

  return (
    <View
      className="flex-row items-center px-3"
      style={{
        height: 56,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.borderHairline,
      }}
    >
      {noBack ? (
        <View style={{ width: 12 }} />
      ) : (
        <TouchableOpacity
          onPress={back}
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="w-10 h-10 items-center justify-center mr-1"
          activeOpacity={0.6}
        >
          <Icon name="arrow-left" size={20} color={colors.inkPrimary} />
        </TouchableOpacity>
      )}

      <View className="flex-1">
        <Text variant="h3" className="font-uiSemiBold" numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" style={{ color: colors.inkMuted }} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {action ? (
        action.icon && !action.label ? (
          <TouchableOpacity
            onPress={() => { selectionFeedback(); action.onPress(); }}
            accessibilityLabel={action.icon}
            accessibilityRole="button"
            className="w-10 h-10 items-center justify-center rounded-pill"
            style={{ backgroundColor: colors.surfaceMuted }}
            activeOpacity={0.6}
          >
            <Icon name={action.icon} size={18} color={colors.inkPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { selectionFeedback(); action.onPress(); }}
            className="px-3 py-2"
            activeOpacity={0.6}
          >
            <Text variant="body" className="font-uiMedium" style={{ color: colors.brandPrimary }}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
};
