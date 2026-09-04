/**
 * components/ui/Sheet.tsx
 * ---------------------------------------------------------------------------
 * A bottom sheet: scrim, panel, handle, optional title row.
 *
 * The chat screen has nine of these and each drew its own — different scrim
 * opacities (`bg-black/60`, `/80`), radii (`rounded-t-[32px]`, `rounded-t-3xl`),
 * shadows, and handle sizes. This is the one shell. Content goes inside; the
 * sheet decides nothing about it beyond padding and a maximum height.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Modal, View, TouchableOpacity, TouchableWithoutFeedback, type ViewStyle } from "react-native";
import { Icon } from "../Icon";
import { Text } from "../Typography";
import { useTheme } from "../../theme/ThemeProvider";
import { selectionFeedback } from "../../services/haptics";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** One quiet line under the title. */
  subtitle?: string;
  /** Height as a fraction of the screen. Default lets content decide, capped at 88%. */
  height?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Sheet: React.FC<SheetProps> = ({ visible, onClose, title, subtitle, height, children, style }) => {
  const { colors } = useTheme();

  const close = () => {
    selectionFeedback();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: colors.scrim }}>
        {/* Tapping the scrim closes; the panel below swallows its own taps. */}
        <TouchableWithoutFeedback onPress={close}>
          <View className="flex-1" />
        </TouchableWithoutFeedback>

        <View
          className="rounded-t-sheet px-5 pt-3 pb-6"
          style={[
            {
              backgroundColor: colors.surfaceRaised,
              borderTopWidth: 1,
              borderColor: colors.borderHairline,
              maxHeight: "88%",
              ...(height ? { height: `${Math.round(height * 100)}%` as unknown as number } : {}),
            },
            style,
          ]}
        >
          <View className="items-center mb-3">
            <View className="w-9 h-1 rounded-pill" style={{ backgroundColor: colors.surfaceStrong }} />
          </View>

          {title ? (
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text variant="h3" className="font-uiSemiBold">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>{subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={close}
                accessibilityLabel="Close"
                accessibilityRole="button"
                className="w-8 h-8 rounded-pill items-center justify-center"
                style={{ backgroundColor: colors.surfaceMuted }}
                activeOpacity={0.6}
              >
                <Icon name="x" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
};
