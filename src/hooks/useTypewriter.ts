/**
 * frontend/src/hooks/useTypewriter.ts
 * ---------------------------------------------------------------------------
 * Reveals a string progressively, and stops bothering once it has.
 *
 * Progress is read from the clock, not from a tick count. Counting ticks ties
 * the reveal to the timer's real rate, and that rate is not a constant: a
 * hidden or backgrounded tab throttles timers to about once a second, which
 * turned a 1.5-second reveal into a 40-second crawl. Against the clock, a slow
 * timer only makes the reveal jumpier — it still finishes on time.
 *
 * Two things this must not do: re-animate text the user has already read (a
 * re-render, a theme change, scrolling back up), and animate a conversation
 * restored from history — replaying an old chat is theatre, not feedback. Both
 * are handled by keying on the message id and only animating ids first seen
 * while mounted.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from "react";
import { planReveal, revealedText } from "../services/typewriter";

/** Ids already revealed, so a remount does not replay them. */
const finished = new Set<string>();

export function markAlreadySeen(id: string): void {
  finished.add(id);
}

export function forgetRevealed(): void {
  finished.clear();
}

/**
 * @param id      Stable per message. A changing id restarts the reveal.
 * @param text    The full text.
 * @param animate False for restored history and the user's own messages.
 */
export function useTypewriter(id: string, text: string, animate: boolean): {
  visible: string;
  done: boolean;
} {
  const [words, setWords] = useState(() =>
    !animate || finished.has(id) ? Infinity : 0,
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };

    if (!animate || finished.has(id)) {
      setWords(Infinity);
      return stop;
    }

    const plan = planReveal(text);
    if (plan.instant) {
      finished.add(id);
      setWords(Infinity);
      return stop;
    }

    const totalMs = Math.ceil(plan.totalWords / plan.wordsPerStep) * plan.stepMs;
    const startedAt = Date.now();
    setWords(0);

    timer.current = setInterval(() => {
      const progress = (Date.now() - startedAt) / totalMs;
      if (progress >= 1) {
        stop();
        finished.add(id);
        setWords(Infinity);
        return;
      }
      setWords(Math.max(1, Math.floor(progress * plan.totalWords)));
    }, plan.stepMs);

    return () => {
      stop();
      // Interrupted mid-reveal (unmount, navigation, a new id): show the whole
      // message rather than leaving it truncated at wherever it got to.
      setWords(Infinity);
    };
  }, [id, text, animate]);

  const done = words === Infinity;
  return { visible: done ? text : revealedText(text, words), done };
}
