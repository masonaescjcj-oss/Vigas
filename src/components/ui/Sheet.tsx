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
import { useBreakpoint } from "../../theme/breakpoints";
import { keyEdge } from "../../theme/device";
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
  // A bottom sheet is a phone gesture. On a desktop browser a panel sliding
  // up from the bottom edge of a 1400px window, spanning the whole width, is
  // neither reachable nor readable — so on a wide screen the same content is
  // a centred dialog: no handle, all four corners rounded, capped at a width
  // a person can scan.
  const { wide } = useBreakpoint();

  const close = () => {
    selectionFeedback();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={close}>
      <View className={wide ? "flex-1 justify-center items-center px-6" : "flex-1 justify-end"} style={{ backgroundColor: colors.scrim }}>
        {/* Tapping the scrim closes; the panel below swallows its own taps. */}
        <TouchableWithoutFeedback onPress={close}>
          <View className={wide ? "absolute inset-0" : "flex-1"} />
        </TouchableWithoutFeedback>

        <View
          className={wide ? "rounded-sheet px-5 pt-5 pb-6" : "rounded-t-sheet px-5 pt-3 pb-6"}
          style={[
            {
              backgroundColor: colors.canvasBase,
              borderWidth: wide ? 1 : 0,
              borderTopWidth: 1,
              borderColor: colors.borderHairline,
              maxHeight: "88%",
              ...(wide ? { width: "100%", maxWidth: 520 } : {}),
              ...(height && !wide ? { height: `${Math.round(height * 100)}%` as unknown as number } : {}),
            },
            style,
          ]}
        >
          {wide ? null : (
            <View className="items-center mb-3">
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.surfaceStrong }} />
            </View>
          )}

          {title ? (
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text variant="h2">{title}</Text>
                {subtitle ? (
                  <Text variant="label" style={{ marginTop: 3, textTransform: "none" }}>{subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={close}
                accessibilityLabel="Close"
                accessibilityRole="button"
                style={[{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised }, keyEdge(colors.capEdge)]}
                activeOpacity={0.7}
              >
                <Icon name="x" size={15} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
};
