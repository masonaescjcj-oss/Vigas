/**
 * frontend/src/services/typewriter.ts
 * ---------------------------------------------------------------------------
 * How much of a message is visible at a given moment.
 *
 * Pure on purpose: the interesting behaviour is the pacing, and pacing is easy
 * to get wrong in ways a screenshot will not show — a long answer that takes
 * half a minute to appear, or a reveal that stops mid-word.
 *
 * The reveal is word-by-word rather than character-by-character. Characters
 * look like a terminal; words look like reading, and they cost a fraction of
 * the re-renders.
 * ---------------------------------------------------------------------------
 */

/**
 * Words revealed per second.
 *
 * Around reading pace rather than well above it. Faster than this and the eye
 * registers the text as already-there — the animation runs, but the effect it
 * exists for does not land.
 */
export const WORDS_PER_SECOND = 14;

/**
 * However long the text, the reveal ends within this.
 *
 * Raised from 2.6s, which capped every answer long enough to matter at roughly
 * 17ms a word — fast enough to read as instant, which is the thing the reveal
 * is meant to avoid. Seven seconds is long enough to feel deliberate on the
 * answers that deserve it and still short enough that nobody is held hostage:
 * the whole text is one tap away throughout.
 */
export const MAX_REVEAL_MS = 7_000;

/** Below this there is nothing to animate; showing it at once reads as instant. */
export const MIN_WORDS_TO_ANIMATE = 4;

/**
 * A timer firing faster than this buys nothing — it is below a frame, and each
 * tick is a re-render. Long answers reveal several words per tick instead.
 */
export const MIN_STEP_MS = 16;

export interface RevealPlan {
  /** Total words in the text. */
  totalWords: number;
  /** Milliseconds between ticks. */
  stepMs: number;
  /** Words revealed per tick — more than one for long answers. */
  wordsPerStep: number;
  /** True when the text is too short to be worth animating. */
  instant: boolean;
}

export function planReveal(text: string): RevealPlan {
  const totalWords = countWords(text);
  if (totalWords < MIN_WORDS_TO_ANIMATE) {
    return { totalWords, stepMs: 0, wordsPerStep: 0, instant: true };
  }

  const naturalMs = (totalWords / WORDS_PER_SECOND) * 1000;
  // Never run longer than the cap: the cap sets the pace for long answers.
  const totalMs = Math.min(naturalMs, MAX_REVEAL_MS);

  // Stepping faster than MIN_STEP_MS would overshoot the cap while burning
  // renders, so past that point each tick reveals more words instead.
  const stepMs = Math.max(MIN_STEP_MS, totalMs / totalWords);
  const ticks = Math.max(1, Math.floor(totalMs / stepMs));
  const wordsPerStep = Math.max(1, Math.ceil(totalWords / ticks));

  return { totalWords, stepMs, wordsPerStep, instant: false };
}

function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * The first `wordCount` words of `text`, with their original spacing.
 *
 * Slicing on the original string rather than joining split words keeps
 * newlines, code-block indentation and double spaces intact — markdown that
 * has had its whitespace normalised renders wrong.
 */
export function revealedText(text: string, wordCount: number): string {
  if (wordCount <= 0) return "";
  let seen = 0;
  let index = 0;
  const length = text.length;

  while (index < length) {
    while (index < length && /\s/.test(text[index])) index += 1;
    if (index >= length) break;
    while (index < length && !/\s/.test(text[index])) index += 1;
    seen += 1;
    if (seen >= wordCount) return text.slice(0, index);
  }
  return text;
}
