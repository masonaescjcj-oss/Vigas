'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ModelListItem, ModelTag } from '@vigas/core';
import { formatContext, formatPricePerMillion } from '@/lib/fmt';
import { CopyButton } from './copy-button';
import { Icon, OrgMark } from './ui';

type Cat = 'all' | ModelTag;

const CATS: Array<{ id: Cat; en: string; fa: string }> = [
  { id: 'all', en: 'All', fa: 'همه' },
  { id: 'agents', en: 'Agents', fa: 'ایجنت‌ها' },
  { id: 'coding', en: 'Coding', fa: 'کدنویسی' },
  { id: 'reasoning', en: 'Reasoning', fa: 'استدلال' },
  { id: 'vision', en: 'Vision', fa: 'بینایی' },
  { id: 'free', en: 'Free', fa: 'رایگان' },
];

const FA_TAGS: Record<string, string> = {
  agents: 'ایجنت',
  coding: 'کدنویسی',
  reasoning: 'استدلال',
  vision: 'بینایی',
  free: 'رایگان',
};

function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

export interface ProviderOption {
  name: string;
  color: string;
  letter: string;
}

export function ModelsCatalogue({
  models,
  providers,
  baseUrl = 'https://api.vigas.ai/v1',
  lang = 'en',
}: {
  models: Array<ModelListItem & { color: string; letter: string }>;
  providers: ProviderOption[];
  baseUrl?: string;
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');

  // Deep links from the footer, home page and search: ?org=, ?tag=, ?q=
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const org = sp.get('org');
    const tag = sp.get('tag') as Cat | null;
    const query = sp.get('q');
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL after hydration */
    if (org && providers.some((p) => p.name === org)) {
      setSelectedOrg(org);
    }
    if (tag && CATS.some((c) => c.id === tag)) setCat(tag);
    if (query) setQ(query.slice(0, 100));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [providers]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(
      (m) =>
        (selectedOrg === 'all' || m.org === selectedOrg) &&
        (cat === 'all' || m.tags.includes(cat)) &&
        (!s || `${m.name} ${m.id} ${m.org}`.toLowerCase().includes(s)),
    );
  }, [models, selectedOrg, cat, q]);

  const priceLabel = (micros: number) => (micros === 0 ? (isFa ? 'رایگان' : '$0') : formatPricePerMillion(micros));

  return (
    <section aria-label={isFa ? 'فهرست مدل‌ها' : 'Model catalogue'} style={{ padding: '32px 0 64px' }}>
      {/* Row 1: Pill search + Category chips + Base URL copy pill (matches DModels) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label
          className="field"
          style={{
            flex: '1 1 280px',
            maxWidth: 380,
            minWidth: 0,
            height: 48,
            borderRadius: 999,
            padding: '0 18px',
            background: 'var(--vg-surface)',
          }}
        >
          <Icon name="search" size={16} />
          <span className="sr-only">{isFa ? 'جستجوی مدل‌ها' : 'Search models'}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              isFa
                ? `جستجو در ${toFaDigits(models.length)} مدل…`
                : `Search ${models.length} models…`
            }
            style={{ font: `14.5px ${isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-sans)'}` }}
          />
        </label>

        <div role="group" aria-label={isFa ? 'دسته‌بندی' : 'Category'} className="scroll-x" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', maxWidth: '100%' }}>
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              style={{ borderRadius: 999, minHeight: 38, padding: '0 15px' }}
            >
              {isFa ? c.fa : c.en}
            </button>
          ))}
        </div>

        <div
          dir="ltr"
          style={{
            marginInlineStart: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            height: 48,
            padding: '0 6px 0 18px',
            borderRadius: 999,
            border: '1px solid var(--vg-line2)',
            background: 'var(--vg-surface)',
            maxWidth: '100%',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--vg-ink3)', flexShrink: 0 }}>Base URL</span>
          <code className="mn" style={{ fontSize: 13, color: 'var(--vg-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {baseUrl}
          </code>
          <CopyButton
            text={baseUrl}
            label={isFa ? 'کپی آدرس پایه API' : 'Copy Base URL'}
            copiedText={isFa ? 'کپی شد' : 'Copied'}
            style={{ minHeight: 36, padding: '0 12px', fontSize: 12, borderRadius: 999 }}
          >
            {isFa ? 'کپی' : 'Copy'}
          </CopyButton>
        </div>
      </div>

      {/* Row 2: Horizontal Provider Pills with OrgMarks (matches DModels) */}
      <div className="scroll-x" style={{ display: 'flex', gap: 8, marginTop: 14, paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => setSelectedOrg('all')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: `1px solid ${selectedOrg === 'all' ? 'var(--vg-line2)' : 'var(--vg-line)'}`,
            background: selectedOrg === 'all' ? 'var(--vg-raised)' : 'transparent',
            color: selectedOrg === 'all' ? 'var(--vg-ink)' : 'var(--vg-ink2)',
            fontSize: 13,
            fontWeight: selectedOrg === 'all' ? 600 : 500,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isFa ? 'همه آزمایشگاه‌ها' : 'All labs'}
        </button>
        {providers.map((p) => {
          const active = selectedOrg === p.name;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setSelectedOrg(active ? 'all' : p.name)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 14px 0 6px',
                borderRadius: 999,
                border: `1px solid ${active ? 'var(--vg-orange-edge)' : 'var(--vg-line)'}`,
                background: active ? 'var(--vg-orange-soft)' : 'transparent',
                color: active ? 'var(--vg-ink)' : 'var(--vg-ink2)',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <OrgMark org={p.name} size={24} radius={99} fontSize={12} />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop Table (24px Obsidian Card) */}
      <div style={{ marginTop: 22, border: '1px solid var(--vg-line)', borderRadius: 24, overflow: 'hidden', background: 'var(--vg-surface)' }}>
        <div className="models-desktop tablewrap">
          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <caption className="sr-only">{isFa ? 'مدل‌های هوش مصنوعی با پنجره متنی و قیمت هر ۱ میلیون توکن' : 'AI models with context window and price per 1M tokens'}</caption>
            <colgroup>
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 220 }} />
            </colgroup>
            <thead>
              <tr
                className={isFa ? 'fa-ui' : 'mn'}
                style={{
                  background: 'var(--vg-bg2)',
                  fontSize: 12,
                  color: 'var(--vg-ink3)',
                  borderBottom: '1px solid var(--vg-line)',
                }}
              >
                <th scope="col" style={th('start')}>{isFa ? 'مدل' : 'Model'}</th>
                <th scope="col" style={th()}>{isFa ? 'کانتکست' : 'Context'}</th>
                <th scope="col" style={th()}>{isFa ? 'ورودی / ۱M' : 'Input / 1M'}</th>
                <th scope="col" style={th()}>{isFa ? 'خروجی / ۱M' : 'Output / 1M'}</th>
                <th scope="col" style={th()}>{isFa ? '۲۴ ساعت' : '24h'}</th>
                <th scope="col" style={th()}><span className="sr-only">{isFa ? 'عملیات' : 'Actions'}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, idx) => {
                const isFree = m.inputPerMillionMicros === 0 && m.outputPerMillionMicros === 0;
                const chg =
                  m.priceChange24h < 0
                    ? { t: `▼ ${Math.abs(m.priceChange24h)}%`, c: 'var(--vg-green)' }
                    : m.priceChange24h > 0
                      ? { t: `▲ ${m.priceChange24h}%`, c: 'var(--vg-red)' }
                      : { t: '—', c: 'var(--vg-ink3)' };
                const featured = idx === 0;
                return (
                  <tr
                    key={m.id}
                    className="hov"
                    style={{
                      borderTop: idx ? '1px solid var(--vg-line)' : undefined,
                      background: featured ? 'rgba(255, 90, 31, .05)' : undefined,
                    }}
                  >
                    <th scope="row" style={{ ...td('start'), fontWeight: 400 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        <OrgMark org={m.org} size={40} radius={12} fontSize={18} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <b dir="ltr" style={{ fontWeight: 600, fontSize: 15 }}>
                              {m.name}
                            </b>
                            {isFree && (
                              <span className="mn" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--vg-green-soft)', color: 'var(--vg-green)' }}>
                                FREE
                              </span>
                            )}
                            {m.tags.filter((t) => t !== 'free').slice(0, 2).map((t) => (
                              <span key={t} className="mn" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--vg-raised)', color: 'var(--vg-ink2)' }}>
                                {isFa ? (FA_TAGS[t] ?? t) : t}
                              </span>
                            ))}
                          </div>
                          <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2, textAlign: isFa ? 'right' : undefined }}>
                            {m.id}
                          </div>
                        </div>
                      </div>
                    </th>
                    <td className="mn" dir="ltr" style={{ ...td(), fontSize: 13.5, color: 'var(--vg-ink2)', textAlign: isFa ? 'left' : 'right' }}>
                      {formatContext(m.contextLength)}
                    </td>
                    <td className="mn" dir={isFa && isFree ? 'rtl' : 'ltr'} style={{ ...td(), fontSize: 14, fontWeight: 500, color: isFree ? 'var(--vg-green)' : 'var(--vg-ink)', textAlign: isFa ? 'left' : 'right' }}>
                      {priceLabel(m.inputPerMillionMicros)}
                    </td>
                    <td className="mn" dir={isFa && isFree ? 'rtl' : 'ltr'} style={{ ...td(), fontSize: 14, fontWeight: 500, color: isFree ? 'var(--vg-green)' : 'var(--vg-ink)', textAlign: isFa ? 'left' : 'right' }}>
                      {priceLabel(m.outputPerMillionMicros)}
                    </td>
                    <td className="mn" dir="ltr" style={{ ...td(), fontSize: 12.5, color: chg.c, textAlign: isFa ? 'left' : 'right' }}>
                      {chg.t}
                    </td>
                    <td style={td()}>
                      <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <CopyButton
                          text={m.id}
                          label={isFa ? `کپی شناسه ${m.id}` : `Copy model ID ${m.id}`}
                          copiedText={isFa ? 'کپی شد' : 'Copied'}
                          style={{ minHeight: 36, padding: '0 12px', fontSize: 12.5, borderRadius: 999 }}
                        >
                          {isFa ? 'کپی' : 'Copy'}
                        </CopyButton>
                        <a
                          href={`/chat?model=${encodeURIComponent(m.id)}`}
                          className={featured ? 'btn key' : 'btn gh'}
                          style={{ minHeight: 36, padding: '0 14px', fontSize: 13, borderRadius: 999 }}
                          aria-label={isFa ? `گفتگو با ${m.name} در چت` : `Open ${m.name} in Chat`}
                        >
                          <Icon name="chat" size={14} />
                          {isFa ? 'چت' : 'Chat'}
                        </a>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--vg-ink2)', margin: 0 }}>
              {isFa ? 'مدلی مطابق جستجو پیدا نشد. فیلتر دیگری را امتحان کنید.' : 'No models match. Try another filter.'}
            </p>
          )}
        </div>

        {/* Mobile Cards (matches vigas-design-2026 MModels 3-box cards) */}
        <div className="models-mobile" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--vg-bg)' }}>
          {rows.map((m) => {
            const isFree = m.inputPerMillionMicros === 0 && m.outputPerMillionMicros === 0;
            const chg =
              m.priceChange24h < 0
                ? { t: `▼ ${Math.abs(m.priceChange24h)}%`, c: 'var(--vg-green)' }
                : m.priceChange24h > 0
                  ? { t: `▲ ${m.priceChange24h}%`, c: 'var(--vg-red)' }
                  : { t: '—', c: 'var(--vg-ink3)' };
            return (
              <div
                key={m.id}
                style={{
                  padding: 16,
                  borderRadius: 20,
                  border: '1px solid var(--vg-line)',
                  background: 'var(--vg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <OrgMark org={m.org} size={42} radius={12} fontSize={18} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <b dir="ltr" style={{ fontWeight: 600, fontSize: 15 }}>
                        {m.name}
                      </b>
                      {isFree && (
                        <span className="mn" style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--vg-green-soft)', color: 'var(--vg-green)' }}>
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="mn" dir="ltr" style={{ fontSize: 11.5, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : undefined }}>
                      {m.id}
                    </div>
                  </div>
                  <span className="mn" dir="ltr" style={{ fontSize: 12, color: chg.c, flexShrink: 0 }}>
                    {chg.t}
                  </span>
                </div>

                {/* 3-box metric grid matching MModels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    [isFa ? 'ورودی' : 'Input', priceLabel(m.inputPerMillionMicros)],
                    [isFa ? 'خروجی' : 'Output', priceLabel(m.outputPerMillionMicros)],
                    [isFa ? 'کانتکست' : 'Context', formatContext(m.contextLength)],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ borderRadius: 12, background: 'var(--vg-bg2)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--vg-ink3)' }}>{lbl}</div>
                      <div className="mn" dir="ltr" style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: isFree && lbl !== (isFa ? 'کانتکست' : 'Context') ? 'var(--vg-green)' : 'var(--vg-ink)', textAlign: 'start' }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={`/chat?model=${encodeURIComponent(m.id)}`}
                    className="btn key"
                    style={{ flex: 1, minHeight: 38, fontSize: 13, borderRadius: 999 }}
                  >
                    <Icon name="chat" size={14} />
                    {isFa ? 'شروع چت' : 'Chat'}
                  </a>
                  <CopyButton
                    text={m.id}
                    label={isFa ? `کپی شناسه ${m.id}` : `Copy model ID ${m.id}`}
                    copiedText={isFa ? 'کپی شد' : 'Copied'}
                    style={{ minHeight: 38, padding: '0 14px', fontSize: 12.5, borderRadius: 999 }}
                  >
                    {isFa ? 'کپی ID' : 'Copy ID'}
                  </CopyButton>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--vg-ink2)', margin: 0 }}>
              {isFa ? 'مدلی مطابق جستجو پیدا نشد. فیلتر دیگری را امتحان کنید.' : 'No models match. Try another filter.'}
            </p>
          )}
        </div>
      </div>

      <p className={isFa ? 'fa-ui' : 'mn'} role="status" style={{ fontSize: 12, color: 'var(--vg-ink3)', margin: '12px 0 0' }}>
        {isFa
          ? `نمایش ${toFaDigits(rows.length)} از ${toFaDigits(models.length)} مدل · به‌روزرسانی قیمت‌ها هر ۵ دقیقه`
          : `Showing ${rows.length} of ${models.length} · prices refresh every 5 minutes`}
      </p>
    </section>
  );
}

function th(align: 'start' | 'end' = 'end'): CSSProperties {
  return { padding: '14px 20px', textAlign: align, fontWeight: 500 };
}
function td(align: 'start' | 'end' = 'end'): CSSProperties {
  return { padding: '16px 20px', textAlign: align, verticalAlign: 'middle' };
}
