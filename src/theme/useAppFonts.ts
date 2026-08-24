/**
 * frontend/src/theme/useAppFonts.ts
 * ---------------------------------------------------------------------------
 * Loading the app's typefaces.
 *
 * The theme has named Inter, a serif and JetBrains Mono since the beginning,
 * and Tailwind mapped `font-ui*` onto them — but nothing ever called useFonts,
 * so every one of those names resolved to nothing and the whole app rendered
 * in the platform's default face. Declaring a typographic system is not the
 * same as loading one.
 *
 * Three families, four weights each where it matters:
 *   Inter          Latin UI text — dense, legible at small sizes
 *   Inter 800      headings — the same face, carried by weight alone
 *   Vazirmatn      Persian and Arabic
 *   JetBrains Mono code, file paths, the run log
 *
 * A failure here is not fatal: the app renders in the system face rather than
 * refusing to start, which is a far better outcome than a blank screen because
 * a font file 404'd.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import { useFonts } from "expo-font";

// Imported per weight, from the file, rather than from each package's root.
//
// The root of an @expo-google-fonts package re-exports every weight it ships,
// and Metro cannot tree-shake an asset `require` — so importing four Inter
// weights from "@expo-google-fonts/inter" registered all nine, italics
// included. Measured in a production export: 43 font files, 8.8 MB, for the
// ten faces this app actually sets. On a phone connection that is the
// difference between the app opening and the user leaving.
import Inter_400Regular from "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf";
import Inter_500Medium from "@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf";
import Inter_600SemiBold from "@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf";
import Inter_700Bold from "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf";
import Vazirmatn_400Regular from "@expo-google-fonts/vazirmatn/400Regular/Vazirmatn_400Regular.ttf";
import Vazirmatn_500Medium from "@expo-google-fonts/vazirmatn/500Medium/Vazirmatn_500Medium.ttf";
import Vazirmatn_600SemiBold from "@expo-google-fonts/vazirmatn/600SemiBold/Vazirmatn_600SemiBold.ttf";
import Vazirmatn_700Bold from "@expo-google-fonts/vazirmatn/700Bold/Vazirmatn_700Bold.ttf";
import JetBrainsMono_400Regular from "@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf";
import JetBrainsMono_500Medium from "@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf";
// Heading weights. Same family as the body — headings get weight, not a
// different typeface.
import Inter_800ExtraBold from "@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf";

/**
 * However slow the network, the app appears within this. Waiting on fonts is
 * only ever worth a moment — and useFonts can neither resolve nor reject if a
 * request stalls, which would leave a permanently blank screen.
 */
const MAX_WAIT_MS = 3_000;

/**
 * @returns ready — true once the app should render, whether the fonts loaded,
 *          failed, or ran out of time. Callers should not distinguish: one
 *          means the right typeface, the others mean the system's, and all
 *          three are usable.
 */
export function useAppFonts(): { ready: boolean; failed: boolean } {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    Inter_800ExtraBold,
  });

  return { ready: loaded || !!error || timedOut, failed: !!error || (timedOut && !loaded) };
}
