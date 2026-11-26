'use client';

import { useMemo, useState } from 'react';
import type { ModelListItem } from '@vigas/core';
import { OrgMark } from '@/components/ui';

export function TokenCalculatorCard({
  models,
  lang = 'en',
}: {
  models: ModelListItem[];
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const paidModels = useMemo(() => {
    const featured = models.filter((m) => m.inputPerMillionMicros > 0 || m.outputPerMillionMicros > 0);
    return featured.length > 0 ? featured : models;
  }, [models]);

  const defaultId =
    paidModels.find((m) => m.id.includes('claude-fable') || m.id.includes('claude-sonnet'))?.id ??
    paidModels[0]?.id ??
    '';

  const [selectedId, setSelectedId] = useState(defaultId);
  const [millions, setMillions] = useState(12.5);

  const model = useMemo(
    () => paidModels.find((m) => m.id === selectedId) ?? paidModels[0],
    [paidModels, selectedId],
  );

  // 70% input, 30% output blended cost per 1M tokens
  const blendedMicros = model
    ? Math.round(model.inputPerMillionMicros * 0.7 + model.outputPerMillionMicros * 0.3)
    : 0;
  const estUsd = (blendedMicros / 1_000_000) * millions;
  const tokensPer5Usd = blendedMicros > 0 ? 5_000_000 / blendedMicros : 0;
  const pct = Math.min(100, Math.max(2, ((millions - 1) / 49) * 100));

  if (!model) return null;

  return (
    <div
      className="card"
      style={{
        padding: 24,
        borderRadius: 24,
        background: 'var(--vg-surface)',
        border: '1px solid var(--vg-line)',
        boxShadow: '0 32px 90px -36px rgba(255, 90, 31, .28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="lbl" style={{ color: 'var(--vg-ink3)' }}>
          {isFa ? 'ماشین‌حساب هزینه توکن' : 'Token cost calculator'}
        </span>
        <span
          className="mn"
          dir={isFa ? 'rtl' : 'ltr'}
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--vg-green-soft)',
            color: 'var(--vg-green)',
          }}
        >
          {tokensPer5Usd > 0 ? (
            isFa ? (
              <>
                ۵ دلار = <bdi dir="ltr">{tokensPer5Usd >= 10 ? Math.round(tokensPer5Usd) : tokensPer5Usd.toFixed(1)}M</bdi> توکن
              </>
            ) : (
              `$5 = ${tokensPer5Usd >= 10 ? Math.round(tokensPer5Usd) : tokensPer5Usd.toFixed(1)}M tokens`
            )
          ) : isFa ? (
            'رایگان'
          ) : (
            'FREE'
          )}
        </span>
      </div>

      {/* Model selector */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 14,
          border: '1px solid var(--vg-line2)',
          background: 'var(--vg-bg2)',
        }}
      >
        <OrgMark org={model.org} size={30} radius={9} />
        <select
          aria-label={isFa ? 'انتخاب مدل برای محاسبه هزینه' : 'Select model for cost estimate'}
          value={model.id}
          onChange={(e) => setSelectedId(e.target.value)}
          dir="ltr"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--vg-ink)',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {paidModels.slice(0, 24).map((m) => (
            <option key={m.id} value={m.id} style={{ background: '#141416', color: '#f5f3ef' }}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Slider */}
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--vg-ink2)' }}>
        <span>{isFa ? 'توکن ماهانه' : 'Monthly tokens'}</span>
        <span className="mn" dir="ltr" style={{ fontWeight: 600, color: 'var(--vg-ink)' }}>
          {millions.toFixed(1)}M
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: 10, height: 22, display: 'flex', alignItems: 'center' }} dir="ltr">
        <div style={{ position: 'relative', width: '100%', height: 8, borderRadius: 999, background: 'var(--vg-raised)', overflow: 'hidden' }}>
          <div className="bg-signal-grad" style={{ width: `${pct}%`, height: '100%', borderRadius: 999 }} />
        </div>
        <input
          type="range"
          min={1}
          max={50}
          step={0.5}
          value={millions}
          aria-label={isFa ? 'میلیون توکن ماهانه' : 'Monthly millions of tokens'}
          onChange={(e) => setMillions(Number(e.target.value))}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            opacity: 0,
            cursor: 'pointer',
            margin: 0,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            border: '4px solid #FF5A1F',
            boxShadow: '0 0 12px rgba(255, 90, 31, .5)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Output */}
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>{isFa ? 'برآورد ماهانه' : 'Estimated / month'}</div>
          <div className="dsp" dir="ltr" style={{ fontSize: 44, lineHeight: 1.05, marginTop: 2 }}>
            ${estUsd < 10 ? estUsd.toFixed(2) : estUsd.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'end', fontSize: 12, color: 'var(--vg-ink3)' }}>
          <div>{isFa ? 'در مقایسه با مستقیم' : 'vs. direct'}</div>
          <div className="mn" dir="ltr" style={{ fontSize: 14, fontWeight: 600, color: 'var(--vg-green)', marginTop: 2 }}>
            −$0.00 markup
          </div>
        </div>
      </div>
    </div>
  );
}
