/**
 * frontend/src/components/TextPromptModal.tsx
 * ---------------------------------------------------------------------------
 * A one-field prompt.
 *
 * React Native has no cross-platform text prompt — `Alert.prompt` is iOS only
 * and `window.prompt` is web only — so anything needing typed input on Android
 * either grew a bespoke modal or quietly did nothing. This is that modal, once.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { Modal, TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";

interface TextPromptModalProps {
  visible: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export const TextPromptModal: React.FC<TextPromptModalProps> = ({
  visible,
  title,
  description,
  initialValue = "",
  confirmLabel = "Save",
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);

  // Reopening for a different file must not show the previous one's name.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.scrim }}>
        <View
          className="w-full max-w-md rounded-card p-5"
          style={{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline }}
        >
          <Text variant="body" className="font-uiSemiBold text-left mb-1">{title}</Text>
          {description ? (
            <Text variant="caption" className="opacity-60 text-left leading-5 mb-3">{description}</Text>
          ) : null}

          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => trimmed && onConfirm(trimmed)}
            className="rounded-input px-3 text-sm"
            style={{
              minHeight: 44,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.borderHairline,
              color: colors.inkPrimary,
              outlineStyle: "none",
              outlineWidth: 0,
            } as object}
          />

          <View className="flex-row justify-end mt-4">
            <TouchableOpacity onPress={onCancel} className="px-4 py-2 mr-2">
              <Text variant="caption" className="font-uiMedium opacity-70">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => trimmed && onConfirm(trimmed)}
              disabled={!trimmed}
              className="px-4 py-2 rounded-lg"
              style={{ backgroundColor: colors.brandPrimary, opacity: trimmed ? 1 : 0.4 }}
            >
              <Text variant="caption" className="font-uiSemiBold" style={{ color: colors.canvasBase }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
