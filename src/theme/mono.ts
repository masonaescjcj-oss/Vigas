/**
 * frontend/src/theme/mono.ts
 * ---------------------------------------------------------------------------
 * The monospace family, with the platform fallbacks theme/fonts.ts cannot
 * import.
 *
 * Separate from fonts.ts because this needs `Platform`, which drags
 * react-native in, and fonts.ts is imported by theme/direction.ts — a pure
 * module whose tests would then need a react-native mock.
 *
 * A function, not a constant: the family is only safe to name once the files
 * have loaded, and a constant is read when the module is imported — before
 * they have. Two components captured the old constant at import time and so
 * kept the system face forever.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import { FAMILIES, fontsAreReady } from "./fonts";

/** Preinstalled everywhere: what code is set in before Plex Mono loads, or if it cannot. */
const SYSTEM_MONO = Platform.select({
  // "monospace" is not a real family on iOS; Menlo is what it ships.
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
}) as string;

export function monoFamily(weight: "regular" | "medium" = "regular"): string {
  if (!fontsAreReady()) return SYSTEM_MONO;
  const family = weight === "medium" ? FAMILIES.monoMedium : FAMILIES.mono;
  // The web takes a stack, so a font that fails later still lands on a
  // monospace. Native takes exactly one name.
  return Platform.OS === "web" ? `${family}, ${SYSTEM_MONO}` : family;
}

/** @deprecated read at render time via monoFamily(); kept for callers not yet moved. */
export const MONO_FAMILY = SYSTEM_MONO;
/** @deprecated see MONO_FAMILY. */
export const MONO_FAMILY_MEDIUM = SYSTEM_MONO;
