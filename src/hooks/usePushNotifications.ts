/**
 * frontend/src/hooks/usePushNotifications.ts
 * ---------------------------------------------------------------------------
 * Registering this device once a user is signed in, and doing something useful
 * when they tap the notification.
 *
 * Tapping "Coffee Finder is ready" has to open Coffee Finder. Landing on the
 * home screen and making the user find the project again is the difference
 * between a notification that earns its permission and one that gets switched
 * off.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { NavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../types/navigation";
import { configureNotificationHandler, registerForPush } from "../services/pushService";

interface RunNotificationData {
  kind?: string;
  sessionId?: string;
  projectId?: string;
}

/**
 * @param userId          Non-null once signed in. The token belongs to an
 *                        account, not to an install, so registration waits.
 * @param navigationRef   Used to open the project the notification is about.
 */
export function usePushNotifications(
  userId: string | null,
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>,
): void {
  // Registration is idempotent server-side, but a re-render should not trigger
  // another permission prompt.
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" || !userId) return;
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;

    void (async () => {
      await configureNotificationHandler();
      const result = await registerForPush();
      // Not surfaced to the user: nobody asked for notifications, so a failure
      // here is not an error they need to acknowledge. The Notifications row in
      // settings is where they can see and change the state deliberately.
      if (result.status !== "registered") {
        console.log(`[push] not registered (${result.status})${result.detail ? `: ${result.detail}` : ""}`);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let subscription: { remove(): void } | null = null;
    let cancelled = false;

    void (async () => {
      const Notifications = await import("expo-notifications");

      const open = (data: RunNotificationData) => {
        if (!data?.projectId) return;
        // navigate, not push: the user tapped a notification, so this is where
        // they meant to be — not one level deeper in a stack they never walked.
        navigationRef.current?.navigate("MainTabs", {
          screen: "ProjectsTab",
          params: {
            screen: "AgentChat",
            params: { projectId: data.projectId, sessionId: data.sessionId },
          },
        });
      };

      // A notification tapped while the app was killed is waiting here. Without
      // this, the cold-start case silently drops the user on the home screen.
      const initial = await Notifications.getLastNotificationResponseAsync();
      if (initial && !cancelled) {
        open(initial.notification.request.content.data as RunNotificationData);
      }

      if (cancelled) return;
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        open(response.notification.request.content.data as RunNotificationData);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [navigationRef]);
}
