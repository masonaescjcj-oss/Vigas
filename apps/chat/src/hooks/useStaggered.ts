/**
 * frontend/src/hooks/useStaggered.ts
 * ---------------------------------------------------------------------------
 * Letting a list arrive one row at a time.
 *
 * A run's tool steps are read from `agent_tasks` in one poll, so a plan, six
 * file edits and a verification all appear in the same frame. A minute of work
 * lands as a block, which reads as a page that finished loading rather than as
 * something that happened.
 *
 * Revealing them in sequence costs nothing and describes the work honestly:
 * these steps did occur one after another.
 *
 * Two rules, both from the same source as the text reveal:
 *
 *   - Only rows that arrive while mounted animate. Scrolling back through a
 *     finished run must not replay it.
 *   - A row already shown stays shown. The chat re-renders every few seconds,
 *     and a stagger that restarted on each poll would flicker forever.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from "react";

/** Gap between rows. Fast enough to read as one motion, slow enough to see. */
const STEP_MS = 70;

/**
 * Longest the whole list may take.
 *
 * A forty-step run should not spend three seconds drawing itself. Past this the
 * remaining rows appear together — the effect has already done its job by then.
 */
const MAX_TOTAL_MS = 1_000;

/**
 * How many of `count` rows should be visible right now.
 *
 * @param count   Rows available.
 * @param animate False for restored history.
 */
export function useStaggered(count: number, animate: boolean): number {
  const [shown, setShown] = useState(() => (animate ? 0 : count));
  // The high-water mark. Without it, a poll that returns the same rows would
  // reset the count and replay the animation.
  const revealed = useRef(animate ? 0 : count);

  useEffect(() => {
    if (!animate) {
      revealed.current = count;
      setShown(count);
      return;
    }
    if (revealed.current >= count) {
      // Already caught up — nothing new arrived this poll.
      setShown(revealed.current);
      return;
    }

    const perStep = Math.max(16, Math.min(STEP_MS, MAX_TOTAL_MS / Math.max(1, count)));
    const timer = setInterval(() => {
      revealed.current += 1;
      setShown(revealed.current);
      if (revealed.current >= count) clearInterval(timer);
    }, perStep);

    return () => {
      clearInterval(timer);
      // Interrupted: show everything rather than leaving the list truncated at
      // wherever it happened to stop.
      revealed.current = count;
      setShown(count);
    };
  }, [count, animate]);

  return Math.min(shown, count);
}
