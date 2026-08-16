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
 *   Inter          Latin UI text
 *   Vazirmatn      Persian and Arabic
 *   JetBrains Mono code, file paths, the run log
 *
 * A failure here is not fatal: the app renders in the system face rather than
 * refusing to start, which is a far better outcome than a blank screen because
 * a font file 404'd.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
} from "@expo-google-fonts/vazirmatn";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

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
  });

  return { ready: loaded || !!error || timedOut, failed: !!error || (timedOut && !loaded) };
}
