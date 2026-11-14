'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatUsd } from '@/lib/fmt';
import { OrgMark } from '../ui';

export interface ParetoPoint {
  modelId: string;
  name: string;
  org: string;
  rank: number;
  winRate: number;
  rating: number;
  costPerTaskMicros: number;
  onFrontier: boolean;
  xPct: number;
  yPct: number;
}

const short = (name: string) => name.replace(/ \(.*\)$/, '');

export function ParetoChart({
  points,
  frontierPolyline,
  sMin,
  sMax,
  cMin,
  cMax,
  defaultSelectedId,
  frontierAriaLabel,
}: {
  points: ParetoPoint[];
  frontierPolyline: string;
  sMin: number;
  sMax: number;
  cMin: number;
  cMax: number;
  defaultSelectedId: string | null;
  frontierAriaLabel: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);
  const active = points.find((p) => p.modelId === selectedId) ?? points[0] ?? null;

  return (
    <div className="card" style={{ borderRadius: 22, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h2 className="sf" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
          Pareto frontier
        </h2>
        <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
          score vs $/task
        </span>
      </div>
      <p style={{ margin: '6px 0 14px', fontSize: 13, color: 'var(--vg-ink2)' }}>
        Green models give the best score for their price. Tap any dot to inspect value vs. performance.
      </p>
      <div
        role="region"
        aria-label={frontierAriaLabel}
        style={{ position: 'relative', height: 260, marginLeft: 36, marginBottom: 24, borderLeft: '1px solid var(--vg-line2)', borderBottom: '1px solid var(--vg-line2)' }}
      >
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(239,234,225,.06) 1px,transparent 1px)', backgroundSize: '100% 25%' }}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          <polyline
            points={frontierPolyline}
            fill="none"
            stroke="var(--vg-green)"
            style={{ strokeWidth: 1.5, strokeDasharray: '4 4', vectorEffect: 'non-scaling-stroke' }}
          />
        </svg>
        {points.map((e) => {
          const isSelected = active?.modelId === e.modelId;
          const s = e.onFrontier ? 12 : 9;
          return (
            <button
              key={e.modelId}
              type="button"
              className="pareto-dot"
              aria-pressed={isSelected}
              aria-label={`${short(e.name)}, score ${Math.round(e.rating)}, ${formatUsd(e.costPerTaskMicros)} per task`}
              title={`${short(e.name)} · ${Math.round(e.rating)} · ${formatUsd(e.costPerTaskMicros)}/task`}
              onClick={() => setSelectedId(e.modelId)}
              onFocus={() => setSelectedId(e.modelId)}
              onMouseEnter={() => setSelectedId(e.modelId)}
              style={{
                left: `${e.xPct.toFixed(1)}%`,
                top: `${e.yPct.toFixed(1)}%`,
                width: s,
                height: s,
                background: isSelected ? 'var(--vg-orange)' : e.onFrontier ? 'var(--vg-green)' : 'var(--vg-ink3)',
              }}
            />
          );
        })}
        <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: -36, top: -7, fontSize: 11, color: 'var(--vg-ink3)' }}>
          {sMax}
        </span>
        <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: -36, bottom: -7, fontSize: 11, color: 'var(--vg-ink3)' }}>
          {sMin}
        </span>
        <span className="mn" aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: -22, fontSize: 11, color: 'var(--vg-ink3)' }}>
          {formatUsd(Math.round(cMin))}
        </span>
        <span className="mn" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: -22, fontSize: 11, color: 'var(--vg-ink3)' }}>
          {formatUsd(Math.round(cMax))}
        </span>
      </div>

      {active && (
        <div
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--vg-bg2)',
            border: '1px solid var(--vg-line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <OrgMark org={active.org} size={28} radius={8} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontWeight: 600, fontSize: 14 }}>{short(active.name)}</b>
                {active.onFrontier ? (
                  <span className="pill" style={{ background: 'rgba(111,207,115,.14)', color: 'var(--vg-green)', fontSize: 11 }}>
                    Pareto optimal
                  </span>
                ) : (
                  <span className="pill" style={{ fontSize: 11 }}>
                    Rank #{active.rank}
                  </span>
                )}
              </div>
              <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink2)', marginTop: 3 }}>
                Score {Math.round(active.rating)} · {active.winRate.toFixed(2)}% win · {formatUsd(active.costPerTaskMicros)}/task
              </div>
            </div>
          </div>
          <Link href={`/models?q=${encodeURIComponent(active.modelId)}`} className="btn gh" style={{ minHeight: 34, padding: '0 12px', fontSize: 12, borderRadius: 9 }}>
            API pricing
          </Link>
        </div>
      )}
    </div>
  );
}
