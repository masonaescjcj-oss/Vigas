/**
 * frontend/src/components/PermissionModal.tsx
 * ---------------------------------------------------------------------------
 * Global overlay Modal that prompts the user to confirm/decline sensitive
 * operations requested by the agent (e.g. bash commands, file deletions).
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { View, Modal, TouchableOpacity } from "react-native";
import { Text } from "./Typography";
import { Button } from "./Button";
import { useTheme } from "../theme/ThemeProvider";
import { useChatStore } from "../stores/chatStore";

export const PermissionModal = () => {
  const { colors } = useTheme();
  const { permissionRequest, setPermissionRequest } = useChatStore();

  if (!permissionRequest) return null;

  const handleResolve = (approved: boolean) => {
    permissionRequest.resolve(approved);
    setPermissionRequest(null); // clear request
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={!!permissionRequest}
      onRequestClose={() => handleResolve(false)}
    >
      <View className="flex-1 justify-center bg-black/50 px-6">
        <View 
          className="p-6 rounded-card border border-borderHairline shadow-lg"
          style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
        >
          {/* Header Warning Warning */}
          <Text variant="h3" className="font-uiSemiBold text-red-500 text-right mb-2" style={{ color: colors.failed }}>
            ⚠️ درخواست اجازه دسترسی
          </Text>

          <Text variant="body" className="text-right mb-4">
            ایجنت برای انجام یک عملیات حساس نیاز به تایید شما دارد:
          </Text>

          {/* Details */}
          <View className="bg-surfaceCode p-3 rounded-input border border-borderHairline/30 mb-4" style={{ backgroundColor: colors.surfaceCode }}>
            <Text variant="caption" className="font-uiSemiBold text-right text-accentTeal" style={{ color: colors.accentTeal }}>
              ابزار مورد استفاده: {permissionRequest.toolName}
            </Text>
            <Text variant="body" className="text-right text-xs mt-2 opacity-90">
              {permissionRequest.reason}
            </Text>
          </View>

          {/* Action buttons */}
          <View className="space-y-2 mt-4">
            <Button
              label="تایید و اجازه اجرا (Allow)"
              onPress={() => handleResolve(true)}
              className="w-full"
            />
            
            <View className="flex-row space-x-2 mt-2">
              <Button
                label="همیشه تایید کن (Always)"
                variant="secondary"
                onPress={() => handleResolve(true)}
                className="flex-1 mr-1 border-accentTeal/30"
                style={{ borderColor: `${colors.accentTeal}40` }}
              />
              <Button
                label="رد کردن (Deny)"
                variant="secondary"
                onPress={() => handleResolve(false)}
                className="flex-1 ml-1 border-red-500/30"
                style={{ borderColor: `${colors.failed}40` }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
