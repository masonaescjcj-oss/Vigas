/**
 * components/ui/ScreenHeader.tsx
 * ---------------------------------------------------------------------------
 * The top of every pushed screen: a round back key on the left, the title
 * beside it, one optional action on the right.
 *
 * One shape across twenty-odd screens, so moving between them feels like one
 * instrument. The title is set in the display face; a subtitle underneath is
 * the mono legend — a path, a count, a status.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../Icon";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { keyEdge } from "../../theme/device";
import { selectionFeedback } from "../../services/haptics";

interface ScreenHeaderProps {
  title: string;
  /** One quiet line under the title — a count, a status, a path. */
  subtitle?: string;
  /** Hide the back control on a root screen. */
  noBack?: boolean;
  onBack?: () => void;
  /** One action, right-aligned. An icon alone renders as a round key. */
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

  const roundKey = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...keyEdge(colors.capEdge),
  };

  return (
    <View
      className="flex-row items-center px-4"
      style={{
        minHeight: 64,
        paddingVertical: 12,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.borderHairline,
      }}
    >
      {noBack ? null : (
        <TouchableOpacity
          onPress={back}
          accessibilityLabel="Back"
          accessibilityRole="button"
          style={[roundKey, { marginRight: 12 }]}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={18} color={colors.inkPrimary} />
        </TouchableOpacity>
      )}

      <View className="flex-1">
        {title ? (
          <Text variant="h2" numberOfLines={1} style={{ fontSize: 22, lineHeight: 26 }}>{title}</Text>
        ) : null}
        {subtitle ? (
          <Text variant="label" numberOfLines={1} style={{ marginTop: 1, textTransform: "none" }}>{subtitle}</Text>
        ) : null}
      </View>

      {action ? (
        action.icon && !action.label ? (
          <TouchableOpacity
            onPress={() => { selectionFeedback(); action.onPress(); }}
            accessibilityLabel={action.icon}
            accessibilityRole="button"
            style={roundKey}
            activeOpacity={0.7}
          >
            <Icon name={action.icon} size={17} color={colors.inkSecondary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { selectionFeedback(); action.onPress(); }}
            accessibilityRole="button"
            style={[{ height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surfaceRaised, justifyContent: "center" }, keyEdge(colors.capEdge)]}
            activeOpacity={0.7}
          >
            <Text variant="body" className="font-uiMedium" style={{ color: colors.brandPrimary, fontSize: 14 }}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
};
