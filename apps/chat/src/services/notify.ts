/**
 * frontend/src/services/notify.ts
 * ---------------------------------------------------------------------------
 * Telling the user something, asking them something, offering a choice.
 *
 * These are called from services and hooks, so they cannot render — they hand
 * the request to AlertHost through alertQueue and await the answer. That
 * replaced window.alert/window.confirm, which were never viable as product UI:
 * an embedded browser can block them, a user can tell the browser to stop
 * showing them, and either way the app was left talking to nobody. Worse,
 * window.alert ignores buttons entirely, so a multi-choice prompt on web showed
 * its text and then did nothing at all.
 *
 * The fallback below only runs when no host is mounted — before the tree
 * renders, or in a test. It must still *say* something, hence Alert.alert, and
 * for a question it must answer **no**: the callers guard destructive actions,
 * so silence has to mean don't.
 * ---------------------------------------------------------------------------
 */

import { Alert, Platform } from "react-native";
import { DISMISSED, hasAlertHost, requestAlert } from "./alertQueue";

/** Last resort when the dialog cannot be drawn: at least emit the text. */
function announceWithoutHost(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const web = globalThis as { alert?: (text: string) => void };
    if (typeof web.alert === "function") {
      web.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    // Dialogs are blocked and there is no host — the console is all that is
    // left, and losing the message entirely would be worse.
    console.warn(`[notify] ${title}${message ? ` — ${message}` : ""}`);
    return;
  }
  Alert.alert(title, message);
}

export function notify(title: string, message?: string): void {
  if (!hasAlertHost()) {
    announceWithoutHost(title, message);
    return;
  }
  // Fire and forget: an acknowledgement has nothing to report.
  void requestAlert({ title, message, buttons: [{ label: "OK" }] });
}

/**
 * Ask a yes/no question. Resolves true only on an explicit yes.
 *
 * @param options.destructive Colours the accept button as dangerous. Pass it
 *   for anything that removes or overwrites the user's work.
 */
export async function confirmAction(
  title: string,
  message: string,
  options?: { destructive?: boolean; confirmLabel?: string; cancelLabel?: string },
): Promise<boolean> {
  if (!hasAlertHost()) {
    // No dialog, so no consent. Announcing the question would be worse than
    // silence — the user would read it with no way to answer.
    console.warn(`[notify] confirm requested with no host mounted, refusing: ${title}`);
    return false;
  }
  const pressed = await requestAlert({
    title,
    message,
    buttons: [
      { label: options?.cancelLabel ?? "Cancel" },
      { label: options?.confirmLabel ?? "Confirm", destructive: options?.destructive },
    ],
    cancelIndex: 0,
  });
  return pressed === 1;
}

/**
 * Offer several actions. Resolves the chosen index, or null if dismissed.
 *
 * This is the case window.alert could not express at all: it showed the text
 * and dropped every button, so on web a long-press menu was decoration. Since
 * rename and delete were only reachable that way, files could not be renamed or
 * deleted on web at all.
 */
export async function chooseAction(
  title: string,
  message: string,
  choices: Array<{ label: string; destructive?: boolean }>,
  options?: { cancelLabel?: string },
): Promise<number | null> {
  if (choices.length === 0) return null;
  if (!hasAlertHost()) {
    console.warn(`[notify] choice requested with no host mounted, refusing: ${title}`);
    return null;
  }
  const pressed = await requestAlert({
    title,
    message,
    // Cancel first so the indices the caller passed keep their order after it.
    buttons: [{ label: options?.cancelLabel ?? "Cancel" }, ...choices],
    cancelIndex: 0,
  });
  if (pressed === DISMISSED || pressed === 0) return null;
  return pressed - 1;
}
