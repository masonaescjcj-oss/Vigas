/**
 * frontend/src/theme/fonts.ts
 * ---------------------------------------------------------------------------
 * Which typeface a piece of text should be set in.
 *
 * The answer is now: the device's own.
 *
 * The app shipped Inter, Vazirmatn and JetBrains Mono as downloads. Three
 * reasons that is worse here than the system stack:
 *
 *   - 2.4 MB of fonts before a word appears. With font-display:swap the text
 *     renders in the system face first and reflows when the download lands, so
 *     the first thing a user sees is the system font either way — after which
 *     the download only pays for a reflow.
 *   - No web font covers Persian as well as the device already does. A phone
 *     sold in Iran ships a Persian face tuned for its own screen; replacing it
 *     with Vazirmatn over the network is a downgrade dressed as a choice.
 *   - Every platform's own UI font is the one its users read all day.
 *
 * So nothing is loaded. `undefined` is the right value for React Native and
 * react-native-web alike: it means "inherit", which resolves to San Francisco,
 * Roboto, Segoe UI, or whatever the device uses — including its Arabic-script
 * face, without any detection.
 *
 * The API is unchanged so no caller had to move. Weights still come from the
 * Tailwind classes each component already sets.
 *
 * Deliberately free of react-native imports: theme/direction.ts depends on this
 * for script detection, and pulling Platform in here would force a mock into
 * every test that transitively touches it. The monospace stack, which does need
 * Platform, lives in theme/mono.ts.
 * ---------------------------------------------------------------------------
 */

export type FontWeightName = "regular" | "medium" | "semibold" | "bold";

/**
 * Arabic script, including the Persian-specific letters and the Arabic
 * Presentation Forms blocks that copied text often arrives in.
 *
 * Kept because direction and alignment still depend on it — see theme/direction
 * — even though the family no longer does.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** True when the text contains any Arabic-script character. */
export function hasArabicScript(text: unknown): boolean {
  return typeof text === "string" && ARABIC_SCRIPT.test(text);
}

/**
 * The family to set this text in.
 *
 * Undefined — the device decides, and it decides correctly for whichever
 * script it is handed. Kept as a function so the call sites did not have to
 * change and so a family could be reintroduced in one place if that ever
 * becomes the right answer again.
 */
export function fontFamilyFor(
  _text?: unknown,
  _weight: FontWeightName = "regular",
): string | undefined {
  return undefined;
}

/** Headings use the same face. Size and weight already separate them. */
export function displayFamilyFor(
  _text?: unknown,
  _weight: "medium" | "bold" = "bold",
): string | undefined {
  return undefined;
}

/**
 * Flatten a React children prop to the text it will render, so a component can
 * pick a family without its callers having to pass the string twice.
 *
 * Still used for direction, which does depend on the text.
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

/**
 * Families the app loads: none.
 *
 * Kept so useAppFonts and this module still have one place that agrees on the
 * answer, and so the loader's "everything used is registered" check has
 * something to check against.
 */
export const ALL_FONT_FAMILIES: string[] = [];
