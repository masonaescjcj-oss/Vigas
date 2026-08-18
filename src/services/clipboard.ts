/**
 * frontend/src/services/clipboard.ts
 * ---------------------------------------------------------------------------
 * Copying text.
 *
 * The agent's answers are full of code the user wants to take somewhere else,
 * and until now there was no way to get it out except selecting it by hand — on a
 * phone, inside a horizontally scrolling block, which is close to impossible.
 *
 * expo-clipboard is imported lazily. It is a native module, and pulling it into
 * the graph at import time makes every module that touches this one harder to
 * test. `navigator.clipboard` is tried first on web, since it needs no module at
 * all and works in the browser the app is usually developed in.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";

/**
 * @returns false when the text could not be copied, so the caller can say so
 *          instead of claiming success. A clipboard write can be refused
 *          outright — no secure context, or no user gesture left to spend.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (Platform.OS === "web") {
    const nav = globalThis.navigator as unknown as {
      clipboard?: { writeText?: (value: string) => Promise<void> };
    } | undefined;
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through: expo-clipboard has its own web path that sometimes
        // succeeds where the bare API is refused.
      }
    }
  }

  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
