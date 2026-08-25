/**
 * frontend/src/theme/useAppFonts.ts
 * ---------------------------------------------------------------------------
 * There are no typefaces to load.
 *
 * The app used to download Inter, Vazirmatn and JetBrains Mono — 2.4 MB before
 * a word appeared. It now uses whatever face the device already has; the
 * reasoning is in theme/fonts.ts, and the short version is that with
 * font-display:swap the system face is what the first paint shows either way,
 * and no web font covers Persian as well as a phone sold in Iran already does.
 *
 * The hook stays because App.tsx gates its first render on it, and because
 * reintroducing a family later should be a change in this folder rather than at
 * the root of the app. It now answers immediately, which removes the blank
 * frame the loader used to hold while files arrived.
 * ---------------------------------------------------------------------------
 */

/**
 * @returns ready — always true, since nothing has to arrive first. `failed`
 *          is kept in the shape so the caller did not have to change.
 */
export function useAppFonts(): { ready: boolean; failed: boolean } {
  return { ready: true, failed: false };
}
