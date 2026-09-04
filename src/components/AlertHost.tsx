/**
 * frontend/src/components/AlertHost.tsx
 * ---------------------------------------------------------------------------
 * The app's own dialog, replacing the browser's.
 *
 * On web, Alert.alert routes to window.alert/window.confirm, and those are not
 * usable as product UI: an embedded browser can block them, a user can tell the
 * browser to stop showing them, and they look nothing like the app. That was
 * not cosmetic — with confirm() suppressed, "Continue as a guest?" silently
 * answered itself, a delete confirm defaulted to *yes*, and the long-press file
 * menu lost its buttons entirely because window.alert has none.
 *
 * So the question is drawn in-app on every platform. One code path, one look,
 * and it can be tested where the app actually runs.
 * ---------------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";
import { Modal, TouchableOpacity, View } from "react-native";
import { Text } from "./Typography";
import { useTheme } from "../theme/ThemeProvider";
import {
  type AlertRequest,
  answerAlert,
  DISMISSED,
  rejectAllAlerts,
  subscribeToAlerts,
} from "../services/alertQueue";
import { directionStyleFor } from "../theme/direction";

export const AlertHost: React.FC = () => {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAlerts(setQueue);
    return () => {
      unsubscribe();
      // Nothing can answer these once the host is gone.
      rejectAllAlerts();
    };
  }, []);

  // Only the oldest is shown; the rest wait their turn rather than stacking
  // translucent scrims on top of each other.
  const current = queue[0];
  if (!current) return null;

  const dismiss = () =>
    answerAlert(current.id, current.cancelIndex ?? DISMISSED);

  // The agent writes in the user's language, so a message can be RTL while the
  // chrome around it is not.
  const titleDirection = directionStyleFor(current.title);
  const messageDirection = current.message ? directionStyleFor(current.message) : undefined;

  // Two buttons fit side by side; more would crowd a phone, so they stack.
  const stacked = current.buttons.length > 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android back and web Escape both land here. Dismiss, never accept —
      // this guards deletes.
      onRequestClose={dismiss}
    >
      {/* The scrim is a palette token, so it is right on all three themes —
          a fixed black/70 sat far too heavy over the light canvas. */}
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.scrim }}>
        <View
          className="w-full max-w-md rounded-card p-5"
          style={{ backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderHairline }}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text variant="body" className="font-uiSemiBold mb-1" style={titleDirection}>
            {current.title}
          </Text>
          {current.message ? (
            <Text variant="caption" className="opacity-60 leading-5 mb-1" style={messageDirection}>
              {current.message}
            </Text>
          ) : null}

          <View className={stacked ? "mt-4" : "flex-row justify-end mt-4"}>
            {current.buttons.map((button, index) => {
              const isCancel = index === current.cancelIndex;
              const isPrimary = !isCancel;
              return (
                <TouchableOpacity
                  key={`${current.id}:${index}`}
                  onPress={() => answerAlert(current.id, index)}
                  accessibilityRole="button"
                  className={
                    stacked
                      ? "px-4 py-3 rounded-lg mb-2 items-center"
                      : isPrimary
                        ? "px-4 py-2 rounded-lg"
                        : "px-4 py-2 mr-2"
                  }
                  style={
                    isPrimary
                      ? { backgroundColor: button.destructive ? colors.failed : colors.brandPrimary }
                      : undefined
                  }
                >
                  <Text
                    variant="caption"
                    className={isPrimary ? "font-uiSemiBold" : "font-uiMedium opacity-70"}
                    style={isPrimary ? { color: colors.canvasBase } : undefined}
                  >
                    {button.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};
