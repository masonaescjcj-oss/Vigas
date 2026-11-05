import type { CSSProperties } from 'react';
import type { Cover } from '@vigas/core';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

type Variant = 'temple' | 'orbits' | 'bars';

function pickVariant(seed: string, category?: string): Variant {
  if (category === 'Analysis' || category === 'Funding') return 'bars';
  if (category === 'Agents' || category === 'Policy') return 'orbits';
  return (['temple', 'orbits', 'bars'] as const)[hash(seed) % 3]!;
}

/** Illustrated cover art drawn in SVG: no photos, no external images. */
export function CoverArt({
  seed,
  color,
  category,
  wide = false,
}: {
  seed: string;
  color: string;
  category?: string;
  /** 21:9 hero instead of 16:10 / 16:9. */
  wide?: boolean;
}) {
  const v = pickVariant(seed, category);
  const W = wide ? 420 : 400;
  const H = wide ? 180 : 250;
  const cx = W / 2;
  if (v === 'temple') {
    const cy = wide ? 78 : 112;
    const s = wide ? 0.88 : 1;
    const top = wide ? 58 : 84;
    const base = wide ? 148 : 195;
    const colH = base - top - 16;
    const cols = [-2, -1, 0, 1, 2];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
        <rect width={W} height={H} fill="#151411" />
        <circle cx={cx} cy={cy} r={104 * s} fill={color} opacity=".16" />
        <circle cx={cx} cy={cy} r={80 * s} fill={color} opacity=".34" />
        <circle cx={cx} cy={cy} r={54 * s} fill="#E3B65C" />
        <rect x={cx - 130 * s} y={top} width={260 * s} height={10 * s} fill="#EFEAE1" />
        {cols.map((k) => (
          <g key={k}>
            <rect x={cx + k * 54 * s - 15 * s} y={top + 12 * s} width={30 * s} height={7 * s} fill="#EFEAE1" />
            <rect x={cx + k * 54 * s - 10 * s} y={top + 19 * s} width={20 * s} height={colH} fill="#EFEAE1" />
          </g>
        ))}
        <rect x={cx - 140 * s} y={base} width={280 * s} height={9 * s} fill="#EFEAE1" />
        <rect x={cx - 156 * s} y={base + 9 * s} width={312 * s} height={11 * s} fill="#EFEAE1" opacity=".7" />
      </svg>
    );
  }
  if (v === 'orbits') {
    const cy = H / 2;
    const r = (n: number) => n * (wide ? 0.8 : 1);
    const planets = [
      [0.7, -0.63, 9, color],
      [-0.27, -0.36, 6, '#9A9DFA'],
      [0.15, 0.46, 7, '#5DB7B0'],
      [-0.56, 0.25, 5, '#6FCF73'],
      [0.65, 0.34, 6, '#F07A72'],
    ] as const;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
        <rect width={W} height={H} fill="#151411" />
        {[28, 56, 84].map((n) => (
          <circle key={n} cx={cx} cy={cy} r={r(n)} fill="none" stroke="rgba(239,234,225,.16)" />
        ))}
        <circle cx={cx} cy={cy} r={r(112)} fill="none" stroke={color} style={{ strokeWidth: 1.6 }} />
        <circle cx={cx} cy={cy} r={r(140)} fill="none" stroke="rgba(239,234,225,.12)" />
        <circle cx={cx} cy={cy} r={r(168)} fill="none" stroke="rgba(239,234,225,.1)" />
        <circle cx={cx} cy={cy} r={r(17)} fill="#E3B65C" />
        {planets.map(([dx, dy, pr, c], i) => (
          <circle key={i} cx={cx + dx * r(112)} cy={cy + dy * r(112)} r={pr} fill={c} />
        ))}
      </svg>
    );
  }
  // bars: a rising colonnade of data
  const n = 9;
  const gap = W / (n + 1);
  const heights = Array.from({ length: n }, (_, i) => 0.25 + ((hash(seed + i) % 100) / 100) * 0.35 + (i / n) * 0.35);
  const floor = H - (wide ? 26 : 36);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      <rect width={W} height={H} fill="#151411" />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={floor * f} y2={floor * f} stroke="rgba(239,234,225,.07)" />
      ))}
      {heights.map((h, i) => {
        const bh = (floor - 18) * h;
        const x = gap * (i + 1) - 11;
        const hot = i === n - 1;
        return (
          <g key={i}>
            <rect x={x - 3} y={floor - bh - 6} width={28} height={5} rx="1" fill={hot ? color : '#3A3631'} />
            <rect x={x} y={floor - bh} width={22} height={bh} fill={hot ? color : '#302D29'} opacity={hot ? 1 : 0.9} />
          </g>
        );
      })}
      <rect x="0" y={floor} width={W} height="4" fill="#EFEAE1" opacity=".7" />
    </svg>
  );
}

/** Small typographic cover: a caption and one big figure on a dotted ground. */
export function TypoCover({
  cover,
  size = 'sm',
  style,
}: {
  cover: Cover;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}) {
  const big = size === 'sm' ? 36 : size === 'md' ? 46 : 56;
  return (
    <span
      aria-hidden="true"
      style={{
        borderRadius: 14,
        backgroundColor: '#151411',
        backgroundImage: 'radial-gradient(rgba(239,234,225,.1) 1px,transparent 1.2px)',
        backgroundSize: '12px 12px',
        border: '1px solid var(--vg-line)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: size === 'sm' ? '10px 12px' : '12px 14px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
        {cover.caption}
      </span>
      <span className="sf" style={{ fontSize: big, lineHeight: 1, color: cover.color, whiteSpace: 'nowrap' }}>
        {cover.big}
      </span>
    </span>
  );
}
