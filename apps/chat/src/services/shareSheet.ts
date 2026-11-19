/**
 * frontend/src/services/shareSheet.ts
 * ---------------------------------------------------------------------------
 * Getting a link out of the app and into a conversation.
 *
 * Three surfaces, three mechanisms, and none of them are guaranteed: the native
 * share sheet does not exist on react-native-web, the Web Share API only exists
 * on some browsers and only over https, and the clipboard API is refused
 * outside a user gesture or a secure context. So each attempt falls through to
 * the next, and the caller is told which one actually happened — the difference
 * between "sent" and "copied" is the difference between the right toast and a
 * confusing one.
 * ---------------------------------------------------------------------------
 */

import { Platform, Share } from "react-native";

export type ShareOutcome = "shared" | "copied" | "manual";

/**
 * @returns How the link left the app. "manual" means it did not — show the URL
 *          and let the user select it themselves.
 */
export async function shareLink(url: string, title?: string): Promise<ShareOutcome> {
  if (Platform.OS !== "web") {
    try {
      await Share.share({ message: url, ...(title ? { title } : {}) }, { dialogTitle: title });
      // The sheet resolves the same way whether the user picked an app or
      // dismissed it, so this is "offered", not "definitely sent". Good enough:
      // the user just watched it happen either way.
      return "shared";
    } catch {
      return "manual";
    }
  }

  // Declared here rather than relied on: react-native's TS lib has no DOM, so
  // neither `share` nor `clipboard` exists on the ambient Navigator type even
  // though both are present in a browser.
  const nav = globalThis.navigator as unknown as {
    share?: (data: { url: string; title?: string }) => Promise<void>;
    clipboard?: { writeText?: (text: string) => Promise<void> };
  } | undefined;

  if (nav?.share) {
    try {
      await nav.share({ url, ...(title ? { title } : {}) });
      return "shared";
    } catch {
      // A dismissed dialog throws AbortError, indistinguishable from a real
      // failure. Fall through to the clipboard rather than claim success.
    }
  }

  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(url);
      return "copied";
    } catch { /* not a secure context, or no gesture left to spend */ }
  }

  return "manual";
}
