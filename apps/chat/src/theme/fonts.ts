/**
 * frontend/src/theme/fonts.ts
 * ---------------------------------------------------------------------------
 * Which typeface a piece of text should be set in.
 *
 *   Bricolage Grotesque   display — titles, the wordmark, big numbers
 *   IBM Plex Sans         everything you read
 *   IBM Plex Mono         labels, code, paths, the run tape
 *
 * Plex comes from IBM and was drawn with its machines in mind, which is the
 * lineage the app's name points at. Six files, about a megabyte, bundled rather
 * than fetched so the first frame is already in the right face.
 *
 * Persian and Arabic are deliberately NOT given a family. No Latin face covers
 * them, and React Native takes one family per Text — so an Arabic-script string
 * gets `undefined`, which means "inherit": the device's own Persian face, which
 * on a phone sold in Iran is tuned for that phone's screen.
 *
 * Each weight is its own family. A custom font on iOS and Android does not
 * respond to `fontWeight` the way the system face does — asking for bold in a
 * regular file gets regular, or a smeared synthetic bold — so the weight picks
 * the file instead.
 *
 * Nothing is returned until the files have loaded. On iOS an unknown family is
 * a red screen in development, and on the web it falls back to Times; both are
 * worse than the system face for the half-second before the fonts arrive.
 *
 * Deliberately free of react-native imports: theme/direction.ts depends on this
 * for script detection, and pulling Platform in here would force a mock into
 * every test that transitively touches it. theme/mono.ts adds the platform
 * fallbacks the monospace stack needs.
 * ---------------------------------------------------------------------------
 */

export type FontWeightName = "regular" | "medium" | "semibold" | "bold";
export type FontRole = "ui" | "display" | "mono";

/** The names useAppFonts registers each file under. */
export const FAMILIES = {
  uiRegular: "IBMPlexSans_400Regular",
  uiMedium: "IBMPlexSans_500Medium",
  uiSemiBold: "IBMPlexSans_600SemiBold",
  display: "BricolageGrotesque_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

/** Every family the loader must register. A name used but not loaded is a crash on iOS. */
export const ALL_FONT_FAMILIES: string[] = Object.values(FAMILIES);

let ready = false;

/** Called once by useAppFonts when the files have loaded (or failed to). */
export function setFontsReady(loaded: boolean): void {
  ready = loaded;
}

export function fontsAreReady(): boolean {
  return ready;
}

/**
 * Arabic script, including the Persian-specific letters and the Arabic
 * Presentation Forms blocks that copied text often arrives in.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** True when the text contains any Arabic-script character. */
export function hasArabicScript(text: unknown): boolean {
  return typeof text === "string" && ARABIC_SCRIPT.test(text);
}

/**
 * The family to set this text in, or undefined to let the device decide.
 *
 * @param text   what the Text will render — Arabic script keeps the system face
 * @param weight picks the file, since custom faces ignore fontWeight
 * @param role   display for titles and the wordmark, mono for code and labels
 */
export function fontFamilyFor(
  text?: unknown,
  weight: FontWeightName = "regular",
  role: FontRole = "ui",
): string | undefined {
  if (!ready) return undefined;
  if (role !== "mono" && hasArabicScript(text)) return undefined;

  if (role === "display") return FAMILIES.display;
  if (role === "mono") return weight === "regular" ? FAMILIES.mono : FAMILIES.monoMedium;

  switch (weight) {
    case "medium":
      return FAMILIES.uiMedium;
    case "semibold":
    case "bold":
      return FAMILIES.uiSemiBold;
    default:
      return FAMILIES.uiRegular;
  }
}

/**
 * The weight a Text asks for, from the Tailwind classes and inline style it
 * already carries. Screens say `font-uiSemiBold` or `font-semibold` or
 * `fontWeight: "600"`; all of those have to land on the SemiBold file.
 */
export function weightFrom(className: string | undefined, fontWeight: unknown, fallback: FontWeightName): FontWeightName {
  const cls = className ?? "";
  if (/\bfont-(uiBold|bold|extrabold|black)\b/.test(cls)) return "bold";
  if (/\bfont-(uiSemiBold|semibold)\b/.test(cls)) return "semibold";
  if (/\bfont-(uiMedium|medium)\b/.test(cls)) return "medium";
  if (/\bfont-(uiRegular|normal|light)\b/.test(cls)) return "regular";

  const w = typeof fontWeight === "number" ? String(fontWeight) : fontWeight;
  if (w === "bold" || w === "700" || w === "800" || w === "900") return "bold";
  if (w === "600") return "semibold";
  if (w === "500") return "medium";
  if (w === "normal" || w === "400" || w === "300") return "regular";

  return fallback;
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
