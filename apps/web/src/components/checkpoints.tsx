'use client';

import { useState } from 'react';

const CP: Array<[string, string, string, string]> = [
  ['v4', 'Navigation', '11m ago', '+96 −4'],
  ['v5', 'Habit list UI', '6m ago', '+214 −30'],
  ['v6', 'Streak logic', '2m ago', '+88 −12'],
  ['v7', 'Weekly heatmap', 'HEAD', 'running…'],
];

/** Example checkpoint strip from the studio preview. */
export function Checkpoints() {
  const [sel, setSel] = useState(3);
  return (
    <div role="group" aria-label="Checkpoints (example)" className="scroll-x" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      {CP.map(([v, t, when, delta], k) => (
        <button key={v} type="button" className="cp" aria-pressed={sel === k} onClick={() => setSel(k)}>
          <span className="mn" style={{ fontSize: 12, color: sel === k ? 'var(--vg-orange-text)' : 'var(--vg-ink3)' }}>
            {v} · {when}
          </span>
          <b style={{ fontWeight: 500, fontSize: 14 }}>{t}</b>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {delta}
          </span>
        </button>
      ))}
    </div>
  );
}
