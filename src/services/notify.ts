/**
 * frontend/src/services/notify.ts
 * ---------------------------------------------------------------------------
 * Cross-platform alert. react-native-web does not implement Alert.alert, so on
 * web every error message raised through it is silently swallowed — the user
 * sees nothing. This routes to window.alert on web and Alert.alert on native.
 * ---------------------------------------------------------------------------
 */

import { Alert, Platform } from "react-native";

export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const web = globalThis as { alert?: (text: string) => void };
    if (typeof web.alert === "function") {
      web.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
  }
  Alert.alert(title, message);
}

/** Cross-platform confirm. Resolves true when the user accepts. */
export function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const web = globalThis as { confirm?: (text: string) => boolean };
    if (typeof web.confirm === "function") {
      return Promise.resolve(web.confirm(`${title}\n\n${message}`));
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirm", onPress: () => resolve(true) },
    ]);
  });
}
