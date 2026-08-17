/**
 * frontend/src/services/pushService.ts
 * ---------------------------------------------------------------------------
 * Letting the app come and find you when a build finishes.
 *
 * A run takes minutes, and on a phone that means the screen locks. Without this
 * the user has to keep opening the app to check, which defeats the point of
 * building on a phone at all.
 *
 * Registration can fail in several genuinely different ways — the user declined,
 * this is a browser, this is a simulator, the project has no EAS id yet — and
 * they need different answers. So the result is a status rather than a boolean:
 * "denied" is a setting the user can change, "unsupported" is not their problem,
 * and "not_configured" is ours.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import { invokeFunction } from "./functionsClient";

export type PushStatus =
  | "registered"
  | "denied"
  | "unsupported"
  | "not_configured"
  | "not_migrated"
  | "failed";

export interface PushResult {
  status: PushStatus;
  detail?: string;
}

/** Android shows nothing at all for a notification with no channel. */
const CHANNEL_ID = "runs";

/**
 * expo-notifications is imported lazily and never on web.
 *
 * On web it pulls in a service-worker path that needs VAPID keys we do not have,
 * and the module's side effects run at import time — so importing it eagerly
 * would cost every web user a broken subsystem for a feature they cannot use.
 */
async function loadNotifications() {
  return await import("expo-notifications");
}

/**
 * Decide what a notification does while the user is looking at the app.
 *
 * It shows nothing. If they are in the app, the run's own UI has already told
 * them, and a banner over the top of it is the app talking to itself.
 */
export async function configureNotificationHandler(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Build results",
        importance: Notifications.AndroidImportance.DEFAULT,
        // A build finishing is worth a buzz but not a full-screen interruption.
        vibrationPattern: [0, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (error) {
    // A missing channel means notifications are not shown; it must not stop the
    // app from starting.
    console.warn(`[push] could not configure notifications: ${String(error)}`);
  }
}

/**
 * The EAS project id, which getExpoPushTokenAsync has required since SDK 49.
 *
 * Absent until someone runs `eas init`, so its absence is a specific, fixable
 * state rather than an unexplained failure.
 */
function projectId(): string | null {
  try {
    // Required lazily: on web this module is never needed.
    const Constants = require("expo-constants").default;
    const config = Constants?.expoConfig ?? Constants?.manifest;
    return config?.extra?.eas?.projectId ?? null;
  } catch {
    return null;
  }
}

function deviceLabel(): string | undefined {
  try {
    const Device = require("expo-device");
    // "Pixel 7" reads better than a model code in a device list.
    return Device?.deviceName ?? Device?.modelName ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ask for permission, get this device's token, and register it.
 *
 * Safe to call on every launch: the server upserts on the token, so a repeat
 * call refreshes `last_seen_at` and nothing else. It must be called only when
 * signed in — the token belongs to an account, not to an install.
 */
export async function registerForPush(): Promise<PushResult> {
  // A browser cannot receive these. Saying so beats asking for a permission
  // that leads nowhere.
  if (Platform.OS === "web") {
    return { status: "unsupported", detail: "Notifications work in the mobile app." };
  }

  const id = projectId();
  if (!id) {
    return {
      status: "not_configured",
      detail: "This build has no EAS project id yet, so a push token cannot be issued.",
    };
  }

  try {
    const Notifications = await loadNotifications();

    // Never re-ask when it has already been decided: on iOS the system dialog
    // appears once ever, and asking again is a silent no.
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) {
      return { status: "denied", detail: "Notifications are turned off for Retro Code." };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;

    await invokeFunction("push-register", {
      body: {
        action: "register",
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        ...(deviceLabel() ? { deviceName: deviceLabel() } : {}),
      },
    });

    return { status: "registered" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The migration is a distinct, fixable state, not a mystery failure.
    if (/PUSH_NOT_MIGRATED|push_tokens/.test(message)) {
      return { status: "not_migrated", detail: message };
    }
    // A simulator has no APNs/FCM registration, so this is the expected path
    // there rather than a bug.
    if (/must be a physical device|simulator|emulator/i.test(message)) {
      return { status: "unsupported", detail: "A simulator cannot receive push notifications." };
    }
    return { status: "failed", detail: message };
  }
}

/** Stop this device receiving notifications — used on sign-out. */
export async function unregisterThisDevice(): Promise<void> {
  if (Platform.OS === "web") return;
  const id = projectId();
  if (!id) return;
  try {
    const Notifications = await loadNotifications();
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await invokeFunction("push-register", { body: { action: "unregister", token } });
  } catch (error) {
    // Signing out must succeed regardless. A token left behind is disabled the
    // first time Expo reports the device as gone.
    console.warn(`[push] could not unregister this device: ${String(error)}`);
  }
}
