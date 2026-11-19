/**
 * frontend/src/theme/direction.ts
 * ---------------------------------------------------------------------------
 * Which way a piece of text runs.
 *
 * The app is English, but the people using it write Persian prompts and get
 * Persian answers, so most of the text on screen is right-to-left. Nothing set a
 * direction anywhere — the script was detected only to pick a font.
 *
 * On web that mostly went unnoticed, because a browser runs the Unicode
 * bidirectional algorithm itself and `text-align: start` then resolves to the
 * right edge. React Native does no such thing: on a real phone a `Text` with no
 * explicit alignment is left-aligned whatever it contains. So the platform the
 * app is actually for is the one where it looks wrong, which is exactly the sort
 * of thing that survives being looked at in a browser.
 *
 * Direction is decided by which script dominates, not by whether any Arabic
 * character is present. "Save it as index.html" inside a Persian sentence must
 * not flip the sentence, and `console.log("سلام")` must stay left-to-right.
 * ---------------------------------------------------------------------------
 */

import { hasArabicScript, textOf } from "./fonts";

/** Arabic, Persian, and the presentation forms. */
const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
/** Latin, plus the accented ranges. */
const LATIN_LETTERS = /[A-Za-zÀ-ɏ]/g;

export type Direction = "rtl" | "ltr";

function countOf(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * The direction this text should run in.
 *
 * Ties go to left-to-right, which is the safer default: a string with equal
 * amounts of both is usually code or a path, and those read left-to-right.
 */
export function directionOf(text: unknown): Direction {
  const value = typeof text === "string" ? text : textOf(text);
  if (!hasArabicScript(value)) return "ltr";
  return countOf(value, ARABIC_LETTERS) > countOf(value, LATIN_LETTERS) ? "rtl" : "ltr";
}

/**
 * Alignment to match. Stated explicitly rather than left to `start`, because
 * `start` only resolves correctly where something has already established the
 * direction — true in a browser, not true in React Native.
 */
export function alignmentOf(text: unknown): "left" | "right" {
  return directionOf(text) === "rtl" ? "right" : "left";
}

/**
 * Everything a Text or TextInput needs to render this string the right way
 * round, so callers cannot set one and forget the other.
 */
export function directionStyleFor(text: unknown): {
  textAlign: "left" | "right";
  writingDirection: Direction;
} {
  const direction = directionOf(text);
  return {
    textAlign: direction === "rtl" ? "right" : "left",
    writingDirection: direction,
  };
}
