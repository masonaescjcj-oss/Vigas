/**
 * frontend/src/theme/fonts.ts
 * ---------------------------------------------------------------------------
 * Which typeface a piece of text should be set in.
 *
 * React Native takes one `fontFamily` per Text — there is no CSS-style
 * fallback list on native, so a single family has to cover whatever it is
 * given. No good Latin face covers Persian well, and no good Persian face
 * covers Latin as well as Inter does, so the family is chosen per string
 * instead:
 *
 *   Latin, digits, code  → Inter        (the UI face Linear and Vercel use)
 *   Persian and Arabic   → Vazirmatn    (the best free Persian typeface)
 *   Code                 → JetBrains Mono
 *
 * The detection is deliberately simple and lives here, away from React, so the
 * rule can be tested: text with any Arabic-script letter is set in Vazirmatn.
 * Mixed strings — "the file src/app.js را باز کن" — go to Vazirmatn too,
 * because its Latin is good enough that one family reads better than a line
 * that switches typeface mid-sentence.
 * ---------------------------------------------------------------------------
 */

export type FontWeightName = "regular" | "medium" | "semibold" | "bold";

/**
 * Arabic script, including the Persian-specific letters and the Arabic
 * Presentation Forms blocks that copied text often arrives in.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Latin families, by weight. Names match what useFonts registers. */
const LATIN: Record<FontWeightName, string> = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

const PERSIAN: Record<FontWeightName, string> = {
  regular: "Vazirmatn_400Regular",
  medium: "Vazirmatn_500Medium",
  semibold: "Vazirmatn_600SemiBold",
  bold: "Vazirmatn_700Bold",
};

export const MONO_FAMILY = "JetBrainsMono_400Regular";
export const MONO_FAMILY_MEDIUM = "JetBrainsMono_500Medium";

/**
 * The display face, for headings only.
 *
 * Inter is the right choice for the interface — it was designed for dense UI at
 * small sizes and nothing free beats it there. It is also on every SaaS
 * dashboard, which is why an app set entirely in it reads as competent rather
 * than as anything in particular.
 *
 * Headings are the same typeface, carried by weight alone — Inter 800 where
 * the scale calls for bold, 700 where it calls for medium.
 *
 * A second face was tried here and removed. A display typeface gives an
 * interface a voice, which is the last thing a dense tool wants: the letters
 * start being noticed instead of read. Weight gives a heading all the
 * separation it needs and nothing it does not.
 *
 * Vazirmatn covers Arabic script at matching weights, so displayFamilyFor
 * still routes Persian headings there rather than to a face without the
 * glyphs.
 */
const DISPLAY: Record<"medium" | "bold", string> = {
  medium: "Inter_700Bold",
  bold: "Inter_800ExtraBold",
};

/** True when the text contains any Arabic-script character. */
export function hasArabicScript(text: unknown): boolean {
  return typeof text === "string" && ARABIC_SCRIPT.test(text);
}

/**
 * The family to set this text in.
 *
 * @param text   What will be rendered. Non-strings (a number, a nested node)
 *               fall to Latin, which is right for digits and for the icon and
 *               badge text that makes up most non-string children.
 */
export function fontFamilyFor(text: unknown, weight: FontWeightName = "regular"): string {
  return hasArabicScript(text) ? PERSIAN[weight] : LATIN[weight];
}

/**
 * The family for a heading.
 *
 * Falls back to Vazirmatn for Arabic script, because the display face has no
 * Arabic coverage at all — setting a Persian heading in it would render boxes
 * or silently drop to a system font mid-interface.
 */
export function displayFamilyFor(text: unknown, weight: "medium" | "bold" = "bold"): string {
  if (hasArabicScript(text)) return PERSIAN[weight === "bold" ? "bold" : "semibold"];
  return DISPLAY[weight];
}

/**
 * Flatten a React children prop to the text it will render, so a component can
 * pick a family without its callers having to pass the string twice.
 */
export function textOf(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in (children as Record<string, unknown>)) {
    const props = (children as { props?: { children?: unknown } }).props;
    return props ? textOf(props.children) : "";
  }
  return "";
}

/** Every family the app loads, so the loader and this module cannot drift. */
export const ALL_FONT_FAMILIES = [
  // Deduplicated: now that headings are Inter at a heavier weight rather than a
  // separate face, Inter_700Bold serves both body and display. The loader
  // registers each family once, so listing it twice would only make the
  // "everything used is loaded" check compare mismatched lengths.
  ...new Set([
    ...Object.values(LATIN),
    ...Object.values(PERSIAN),
    ...Object.values(DISPLAY),
    MONO_FAMILY,
    MONO_FAMILY_MEDIUM,
  ]),
];
