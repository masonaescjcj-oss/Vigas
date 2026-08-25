/**
 * The pacing is the feature. Getting it wrong is not a cosmetic bug: a long
 * answer that reveals at a fixed rate holds the reader for half a minute, and
 * slicing on word boundaries wrongly mangles markdown.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_REVEAL_MS,
  MIN_STEP_MS,
  MIN_WORDS_TO_ANIMATE,
  planReveal,
  revealedText,
} from "../typewriter";

describe("planReveal", () => {
  it("does not animate a short reply", () => {
    expect(planReveal("ok").instant).toBe(true);
    expect(planReveal("done, saved it").instant).toBe(true);
  });

  it("animates once there is enough to read", () => {
    const plan = planReveal("a b c d e f g h");
    expect(plan.instant).toBe(false);
    expect(plan.totalWords).toBe(8);
  });

  it("finishes a long answer within the cap rather than running on", () => {
    const long = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
    const plan = planReveal(long);
    const ticks = Math.ceil(plan.totalWords / plan.wordsPerStep);
    expect(ticks * plan.stepMs).toBeLessThanOrEqual(MAX_REVEAL_MS + plan.stepMs);
  });

  it("reveals several words per tick when one per tick would be too slow", () => {
    const long = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
    expect(planReveal(long).wordsPerStep).toBeGreaterThan(1);
  });

  it("reveals one word at a time when there is room to", () => {
    expect(planReveal("one two three four five six").wordsPerStep).toBe(1);
  });

  it("keeps a medium answer at a readable pace instead of using the whole cap", () => {
    const plan = planReveal(Array.from({ length: 20 }, () => "word").join(" "));
    expect(plan.totalWords * plan.stepMs).toBeLessThan(MAX_REVEAL_MS);
  });

  it("never steps faster than a frame", () => {
    const huge = Array.from({ length: 20_000 }, () => "w").join(" ");
    expect(planReveal(huge).stepMs).toBeGreaterThanOrEqual(MIN_STEP_MS);
  });

  it("keeps even a very long answer inside the cap", () => {
    const huge = Array.from({ length: 20_000 }, () => "w").join(" ");
    const plan = planReveal(huge);
    const ticks = Math.ceil(plan.totalWords / plan.wordsPerStep);
    expect(ticks * plan.stepMs).toBeLessThanOrEqual(MAX_REVEAL_MS + plan.stepMs);
  });

  it("counts no words in empty text", () => {
    expect(planReveal("   ").totalWords).toBe(0);
    expect(planReveal("").instant).toBe(true);
  });
});

describe("revealedText", () => {
  it("shows nothing at zero", () => {
    expect(revealedText("hello world", 0)).toBe("");
  });

  it("stops on a word boundary, never mid-word", () => {
    expect(revealedText("hello world again", 1)).toBe("hello");
    expect(revealedText("hello world again", 2)).toBe("hello world");
  });

  it("returns everything once the count passes the end", () => {
    expect(revealedText("hello world", 99)).toBe("hello world");
  });

  it("preserves newlines and indentation, so markdown survives", () => {
    const md = "Here:\n\n```js\n  const a = 1;\n```";
    const partial = revealedText(md, 3);
    expect(md.startsWith(partial)).toBe(true);
    expect(partial).toContain("\n");
  });

  it("does not collapse repeated whitespace", () => {
    expect(revealedText("a  b", 2)).toBe("a  b");
  });

  it("agrees with the plan's word count at the end", () => {
    const text = "one two three four five";
    expect(revealedText(text, planReveal(text).totalWords)).toBe(text);
  });

  it("treats fewer than the animate threshold as trivial", () => {
    expect(MIN_WORDS_TO_ANIMATE).toBeGreaterThan(1);
  });
});

describe("the reveal is slow enough to be seen", () => {
  it("paces a long answer over seconds, not milliseconds", () => {
    // The bug this fixes: the cap was 2.6s, so a 150-word answer revealed at
    // roughly 17ms a word. The animation ran and the eye read it as instant,
    // which is exactly what the reveal exists to avoid.
    const words = 150;
    const plan = planReveal(Array.from({ length: words }, (_, i) => `w${i}`).join(" "));
    const totalMs = Math.ceil(plan.totalWords / plan.wordsPerStep) * plan.stepMs;

    expect(totalMs).toBeGreaterThan(3_000);
    const msPerWord = totalMs / plan.totalWords;
    expect(msPerWord).toBeGreaterThan(25);
  });

  it("still refuses to hold a very long answer hostage", () => {
    const plan = planReveal(Array.from({ length: 4_000 }, (_, i) => `w${i}`).join(" "));
    const totalMs = Math.ceil(plan.totalWords / plan.wordsPerStep) * plan.stepMs;
    // An answer is information first; the cap is what keeps that true.
    expect(totalMs).toBeLessThanOrEqual(MAX_REVEAL_MS + plan.stepMs);
  });

  it("shows a one-line answer at once", () => {
    // "Done." animating is theatre, not feedback.
    expect(planReveal("Done.").instant).toBe(true);
  });
});
