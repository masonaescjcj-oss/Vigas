'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { ModelListItem, ModelTag } from '@vigas/core';
import { formatCompact, formatContext, formatPricePerMillion, formatUsd } from '@/lib/fmt';
import { CopyButton } from '../copy-button';
import { Icon, OrgMark } from '../ui';

type Cat = 'all' | ModelTag;

const CATS: Array<{ id: Cat; en: string; fa: string }> = [
  { id: 'all', en: 'All', fa: 'همه' },
  { id: 'coding', en: 'Coding', fa: 'کدنویسی' },
  { id: 'reasoning', en: 'Reasoning', fa: 'استدلال' },
  { id: 'agents', en: 'Agents', fa: 'ایجنت‌ها' },
  { id: 'vision', en: 'Vision', fa: 'بینایی' },
  { id: 'free', en: 'Free', fa: 'رایگان' },
];

const WORKLOAD_PRESETS = [
  { id: 'chat', en: 'Short chat (1K in / 500 out)', fa: 'چت کوتاه (۱K ورودی / ۵۰۰ خروجی)', input: 1000, output: 500 },
  { id: 'code', en: 'Coding turn (12K in / 2K out)', fa: 'کدنویسی (۱۲K ورودی / ۲K خروجی)', input: 12000, output: 2000 },
  { id: 'doc', en: 'Document analysis (60K in / 4K out)', fa: 'تحلیل سند (۶۰K ورودی / ۴K خروجی)', input: 60000, output: 4000 },
] as const;

export function DashboardModels({
  models,
  balanceMicros,
  lang = 'en',
  onUseModelInCode,
}: {
  models: ModelListItem[];
  balanceMicros: number;
  lang?: 'en' | 'fa';
  onUseModelInCode: (modelId: string) => void;
}) {
  const isFa = lang === 'fa';
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [calcModelId, setCalcModelId] = useState<string>(models[0]?.id ?? 'vigas/auto');
  const [inTokens, setInTokens] = useState(12000);
  const [outTokens, setOutTokens] = useState(2000);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter(
      (m) =>
        (cat === 'all' || m.tags.includes(cat)) &&
        (!q || `${m.name} ${m.id} ${m.org}`.toLowerCase().includes(q)),
    );
  }, [models, query, cat]);

  const calcModel = useMemo(
    () => models.find((m) => m.id === calcModelId) ?? models[0] ?? null,
    [models, calcModelId],
  );

  const reqCostMicros = calcModel
    ? Math.round(
        (Math.max(0, inTokens) / 1_000_000) * calcModel.inputPerMillionMicros +
          (Math.max(0, outTokens) / 1_000_000) * calcModel.outputPerMillionMicros,
      )
    : 0;
  const costPer1kMicros = reqCostMicros * 1000;
  const reqsFromBalance = reqCostMicros > 0 && balanceMicros > 0 ? Math.floor(balanceMicros / reqCostMicros) : null;
  const reqsPer10Usd = reqCostMicros > 0 ? Math.floor(10_000_000 / reqCostMicros) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Cost Estimator */}
      <section className="card" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div className="lbl">{isFa ? 'ماشین‌حساب هزینه API' : 'API cost estimator'}</div>
            <h2 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: '6px 0 0', fontWeight: isFa ? 700 : 400 }}>
              {isFa ? 'محاسبه دقیق هزینه توکن قبل از خرید' : 'Estimate request cost before calling'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WORKLOAD_PRESETS.map((p) => {
              const active = inTokens === p.input && outTokens === p.output;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={active}
                  onClick={() => {
                    setInTokens(p.input);
                    setOutTokens(p.output);
                  }}
                >
                  {isFa ? p.fa : p.en}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={{ minWidth: 0 }}>
            <span style={fieldLabel}>{isFa ? 'مدل انتخابی' : 'Model'}</span>
            <select
              value={calcModel?.id ?? ''}
              onChange={(e) => setCalcModelId(e.target.value)}
              className="input"
              dir="ltr"
              style={{ height: 44, fontFamily: 'var(--vg-font-mono)', fontSize: 13 }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.org})
                </option>
              ))}
            </select>
          </label>
          <label style={{ minWidth: 0 }}>
            <span style={fieldLabel}>{isFa ? 'توکن ورودی (Input)' : 'Input tokens'}</span>
            <input
              type="number"
              dir="ltr"
              min={0}
              max={2_000_000}
              step={500}
              value={inTokens}
              onChange={(e) => setInTokens(Math.max(0, Number(e.target.value) || 0))}
              className="input"
              style={{ height: 44, fontFamily: 'var(--vg-font-mono)' }}
            />
          </label>
          <label style={{ minWidth: 0 }}>
            <span style={fieldLabel}>{isFa ? 'توکن خروجی (Output)' : 'Output tokens'}</span>
            <input
              type="number"
              dir="ltr"
              min={0}
              max={200_000}
              step={250}
              value={outTokens}
              onChange={(e) => setOutTokens(Math.max(0, Number(e.target.value) || 0))}
              className="input"
              style={{ height: 44, fontFamily: 'var(--vg-font-mono)' }}
            />
          </label>
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            padding: 14,
            borderRadius: 14,
            background: 'var(--vg-bg2)',
            border: '1px solid var(--vg-line)',
          }}
        >
          <div>
            <div className="lbl">{isFa ? 'هزینه هر درخواست' : 'Per request'}</div>
            <div className="mn" dir="ltr" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: 'var(--vg-orange-text)', textAlign: isFa ? 'right' : 'left' }}>
              {reqCostMicros === 0 ? (isFa ? 'رایگان' : 'Free') : formatUsd(reqCostMicros, { maxDecimals: 5 })}
            </div>
          </div>
          <div>
            <div className="lbl">{isFa ? 'هزینه ۱,۰۰۰ درخواست' : 'Per 1,000 requests'}</div>
            <div className="mn" dir="ltr" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, textAlign: isFa ? 'right' : 'left' }}>
              {costPer1kMicros === 0 ? (isFa ? 'رایگان' : 'Free') : formatUsd(costPer1kMicros, { maxDecimals: 2 })}
            </div>
          </div>
          <div>
            <div className="lbl">{balanceMicros > 0 ? (isFa ? 'تعداد درخواست با موجودی فعلی' : 'With your balance') : isFa ? 'با هر $10 شارژ' : 'Per $10 credit'}</div>
            <div className="mn" dir="ltr" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: 'var(--vg-green)', textAlign: isFa ? 'right' : 'left' }}>
              {reqCostMicros === 0
                ? '∞'
                : balanceMicros > 0 && reqsFromBalance !== null
                  ? `≈ ${formatCompact(reqsFromBalance)}`
                  : reqsPer10Usd !== null
                    ? `≈ ${formatCompact(reqsPer10Usd)}`
                    : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Searchable Models Table */}
      <section className="card" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div className="lbl">{isFa ? 'کاتالوگ مدل‌های API' : 'Unified model catalog'}</div>
            <h2 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: '6px 0 0', fontWeight: isFa ? 700 : 400 }}>
              {isFa ? `${models.length} مدل آماده با یک کلید API` : `${models.length} models · one API key`}
            </h2>
          </div>
          <label className="field" style={{ flex: '1 1 240px', maxWidth: 340, height: 42 }}>
            <Icon name="search" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isFa ? 'جستجوی مدل، شرکت یا شناسه…' : 'Search model, lab or ID…'}
              style={{ fontSize: 14 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CATS.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {isFa ? c.fa : c.en}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid var(--vg-line)',
                background: 'var(--vg-bg2)',
              }}
            >
              <OrgMark org={m.org} size={34} radius={10} fontSize={15} />
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b dir="ltr" style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {m.name}
                  </b>
                  <span className="mn" dir="ltr" style={{ fontSize: 11.5, color: 'var(--vg-ink3)' }}>
                    {formatContext(m.contextLength)} ctx
                  </span>
                </div>
                <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: isFa ? 'right' : 'left' }}>
                  {m.id}
                </div>
              </div>
              <div className="mn" dir="ltr" style={{ fontSize: 12.5, color: 'var(--vg-ink2)', minWidth: 165, textAlign: 'end' }}>
                <div>
                  In: <b style={{ color: 'var(--vg-ink)' }}>{formatPricePerMillion(m.inputPerMillionMicros)}</b>
                </div>
                <div>
                  Out: <b style={{ color: 'var(--vg-ink)' }}>{formatPricePerMillion(m.outputPerMillionMicros)}</b>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn key"
                  onClick={() => onUseModelInCode(m.id)}
                  style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5, borderRadius: 9 }}
                >
                  <Icon name="code" size={14} />
                  {isFa ? 'کد API' : 'Get code'}
                </button>
                <a
                  href={`/chat?model=${encodeURIComponent(m.id)}`}
                  className="btn gh"
                  style={{ minHeight: 34, padding: '0 10px', fontSize: 12.5, borderRadius: 9 }}
                >
                  {isFa ? 'تست در چت' : 'Test in chat'}
                </a>
                <CopyButton
                  text={m.id}
                  label={isFa ? `کپی شناسه ${m.id}` : `Copy ${m.id}`}
                  copiedText={isFa ? 'کپی شد' : 'Copied'}
                  style={{ minHeight: 34, padding: '0 10px', fontSize: 12.5, borderRadius: 9 }}
                >
                  {isFa ? 'کپی ID' : 'Copy ID'}
                </CopyButton>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ margin: '18px 0 6px', textAlign: 'center', color: 'var(--vg-ink3)', fontSize: 14 }}>
              {isFa ? 'مدلی با این فیلتر پیدا نشد.' : 'No models match this filter.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

const card: CSSProperties = { minWidth: 0, borderRadius: 22, padding: 24 };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 500, marginBottom: 7, color: 'var(--vg-ink2)' };
