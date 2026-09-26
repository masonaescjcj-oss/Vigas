/**
 * frontend/src/theme/useAppFonts.ts
 * ---------------------------------------------------------------------------
 * Load the six font files before the first frame.
 *
 * Each file is required by path rather than through the package's index: the
 * index requires every weight it ships, and Metro bundles whatever is required,
 * so importing it would put all fourteen Plex Sans files in the build to use
 * three of them.
 *
 * `ready` turns true on failure too. A font that will not load costs the right
 * typeface, never the app — theme/fonts.ts then hands out no family at all and
 * the device's own face is used.
 * ---------------------------------------------------------------------------
 */

import { useEffect } from "react";
import { useFonts } from "expo-font";
import { FAMILIES, setFontsReady } from "./fonts";

const FILES = {
  [FAMILIES.uiRegular]: require("@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf"),
  [FAMILIES.uiMedium]: require("@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf"),
  [FAMILIES.uiSemiBold]: require("@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf"),
  [FAMILIES.display]: require("@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf"),
  [FAMILIES.mono]: require("@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf"),
  [FAMILIES.monoMedium]: require("@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf"),
};

export function useAppFonts(): { ready: boolean; failed: boolean } {
  const [loaded, error] = useFonts(FILES);

  // Set synchronously during render as well as in the effect: the first frame
  // after loading must already see the families, and an effect runs after it.
  if (loaded && !error) setFontsReady(true);

  useEffect(() => {
    setFontsReady(loaded && !error);
  }, [loaded, error]);

  return { ready: loaded || !!error, failed: !!error };
}
