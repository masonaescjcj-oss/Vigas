import type { CSSProperties } from 'react';

const ROUTE_ORGS = [
  { id: 'anthropic', glyph: 'A', color: '#E3B65C', lat: 175 },
  { id: 'openai', glyph: 'O', color: '#3EE39B', lat: 140 },
  { id: 'google', glyph: 'G', color: '#5CC8FF', lat: 88 },
  { id: 'deepseek', glyph: 'D', color: '#8F8CFF', lat: 98 },
  { id: 'meta', glyph: 'M', color: '#7AA2F7', lat: 110 },
  { id: 'xai', glyph: 'X', color: '#A6A5AB', lat: 200 },
  { id: 'you', glyph: 'Y', color: '#FF7A45', lat: 210 },
] as const;

/**
 * Obsidian Signal 2026 signature centerpiece: one Vigas API key (`sk-vg`) fanning
 * live animated signal lines out to every frontier AI lab with sub-120ms routing.
 */
export function RouterViz({
  width = 560,
  height = 460,
  compact = false,
  style,
}: {
  width?: number;
  height?: number;
  compact?: boolean;
  style?: CSSProperties;
}) {
  const cx = width / 2;
  const cy = height * 0.78;
  const r = Math.min(width * 0.42, height * 0.62);
  const nodes = ROUTE_ORGS.map((o, i) => {
    const a = Math.PI + (Math.PI * (i + 0.5)) / ROUTE_ORGS.length;
    return { ...o, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 1.02 };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ width: '100%', height: 'auto', overflow: 'visible', direction: 'ltr', color: 'var(--vg-ink)', ...style }}
    >
      <defs>
        <radialGradient id="vg-rv-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFD29A" />
          <stop offset="0.45" stopColor="#FF7A2E" />
          <stop offset="1" stopColor="#FF4D1A" />
        </radialGradient>
        <radialGradient id="vg-rv-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FF5A1F" stopOpacity="0.42" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vg-rv-line" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FF5A1F" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {[0.35, 0.62, 0.9].map((k) => (
        <circle key={k} cx={cx} cy={cy} r={r * k} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 6" />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.56} fill="url(#vg-rv-halo)" />
      {nodes.map((nd, i) => {
        const mx = (cx + nd.x) / 2;
        const path = `M ${cx} ${cy} Q ${mx} ${cy - 10} ${nd.x} ${nd.y}`;
        return (
          <g key={nd.id}>
            <path d={path} fill="none" stroke="url(#vg-rv-line)" strokeWidth="1.4" />
            <path
              d={path}
              fill="none"
              stroke="#FF8A3D"
              strokeWidth="2"
              strokeDasharray="4 44"
              className="vg-dash-anim"
              style={{ animationDelay: `${i * -0.25}s` }}
            />
          </g>
        );
      })}
      {nodes.map((nd) => {
        const s = compact ? 34 : 44;
        return (
          <g key={`${nd.id}-n`} transform={`translate(${nd.x - s / 2} ${nd.y - s / 2})`}>
            <rect width={s} height={s} rx={s * 0.32} fill="var(--vg-surface)" stroke="var(--vg-line2)" />
            <text
              x={s / 2}
              y={s / 2 + s * 0.16}
              textAnchor="middle"
              fontSize={s * 0.42}
              fontWeight="700"
              fill={nd.color}
              fontFamily="var(--vg-font-sans)"
            >
              {nd.glyph}
            </text>
            {!compact && (
              <text x={s / 2} y={-10} textAnchor="middle" fontSize="11" fill="var(--vg-ink3)" fontFamily="var(--vg-font-mono)">
                {nd.lat}ms
              </text>
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={compact ? 30 : 40} fill="url(#vg-rv-core)" />
      <circle cx={cx} cy={cy} r={compact ? 40 : 54} fill="none" stroke="#FF5A1F" strokeOpacity="0.35" />
      <circle
        cx={cx}
        cy={cy}
        r={compact ? 50 : 68}
        fill="none"
        stroke="#FF5A1F"
        strokeOpacity="0.16"
        strokeDasharray="3 5"
        className="vg-spin-slow"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={compact ? 12 : 14} fontWeight="700" fill="#fff" fontFamily="var(--vg-font-mono)">
        sk-vg
      </text>
    </svg>
  );
}

/** Concentric glowing signal rings — signature motif on Wallet Hero, Sign-In, and promo surfaces. */
export function SignalRings({ size = 220, style, className }: { size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className} style={{ pointerEvents: 'none', ...style }}>
      <defs>
        <linearGradient id="vg-sr-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD29A" />
          <stop offset="1" stopColor="#FF4D1A" />
        </linearGradient>
      </defs>
      {[46, 38, 30, 22].map((r, i) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#vg-sr-grad)"
          strokeOpacity={0.12 + i * 0.12}
          strokeWidth={i === 3 ? 1.6 : 0.8}
        />
      ))}
      <circle cx="50" cy="50" r="12" fill="url(#vg-sr-grad)" />
    </svg>
  );
}
