/**
 * frontend/src/theme/mono.ts
 * ---------------------------------------------------------------------------
 * The monospace stack, kept away from the rest of the type rules.
 *
 * Separate from theme/fonts.ts for one structural reason: this needs
 * `Platform`, which drags react-native in, and fonts.ts is imported by
 * theme/direction.ts — a pure module whose tests would then need a
 * react-native mock to parse Flow sources they have no other reason to touch.
 * One import in the wrong file turns a pure dependency into a mocked one
 * everywhere downstream.
 *
 * This is also the only place the app still names a family. "The system font"
 * is proportional, and a file tree or a diff set in a proportional face is
 * unreadable — so code gets the monospace each platform already ships, which
 * is still a zero-download choice.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";

/** Preinstalled everywhere, so nothing is fetched. */
export const MONO_FAMILY = Platform.select({
  // "monospace" is not a real family on iOS; Menlo is what it ships.
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}) as string;

/** Same stack — weight is a style, not a second family. */
export const MONO_FAMILY_MEDIUM = MONO_FAMILY;
