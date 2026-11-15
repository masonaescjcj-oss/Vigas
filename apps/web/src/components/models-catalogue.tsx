'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ModelListItem, ModelTag } from '@vigas/core';
import { formatContext, formatPricePerMillion } from '@/lib/fmt';
import { CopyButton } from './copy-button';
import { Icon, OrgMark } from './ui';

type Cat = 'all' | ModelTag;
type Ctx = 'any' | '128k' | '1m';

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
  lang = 'en',
}: {
  models: Array<ModelListItem & { color: string; letter: string }>;
  providers: ProviderOption[];
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [ctx, setCtx] = useState<Ctx>('any');
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Deep links from the footer, home page and search: ?org=, ?tag=, ?q=
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const org = sp.get('org');
    const tag = sp.get('tag') as Cat | null;
    const query = sp.get('q');
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL after hydration */
    if (org && providers.some((p) => p.name === org)) {
      setOff(Object.fromEntries(providers.filter((p) => p.name !== org).map((p) => [p.name, true])));
    }
    if (tag && CATS.some((c) => c.id === tag)) setCat(tag);
    if (query) setQ(query.slice(0, 100));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [providers]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(
      (m) =>
        !off[m.org] &&
        (cat === 'all' || m.tags.includes(cat)) &&
        (ctx === 'any' || (ctx === '128k' ? m.contextLength >= 128_000 : m.contextLength >= 1_000_000)) &&
        (!s || `${m.name} ${m.id} ${m.org}`.toLowerCase().includes(s)),
    );
  }, [models, off, cat, ctx, q]);

  const activeFilterCount = Object.values(off).filter(Boolean).length + (ctx !== 'any' ? 1 : 0);
  const priceLabel = (micros: number) => (isFa && micros === 0 ? 'رایگان' : formatPricePerMillion(micros));

  return (
    <section aria-label={isFa ? 'فهرست مدل‌ها' : 'Model catalogue'} style={{ display: 'flex', flexWrap: 'wrap', gap: 28, padding: '32px 0 72px' }}>
      <aside id="models-filters-panel" aria-label={isFa ? 'فیلترها' : 'Filters'} className="models-filters" data-open={filtersOpen}>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="lbl" style={{ marginBottom: 12, padding: 0 }}>
            {isFa ? 'ارائه‌دهندگان' : 'Providers'}
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {providers.map((p) => (
              <label key={p.name} className="hov" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!off[p.name]}
                  onChange={() => setOff((o) => ({ ...o, [p.name]: !o[p.name] }))}
                  style={{ accentColor: 'var(--vg-orange)', width: 16, height: 16, margin: 0 }}
                />
                <OrgMark org={p.name} size={22} radius={6} fontSize={13} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div role="group" aria-labelledby="ctx-label">
          <div id="ctx-label" className="lbl" style={{ marginBottom: 12 }}>
            {isFa ? 'پنجره متنی (Context)' : 'Context window'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['any', isFa ? 'هر مقدار' : 'Any'],
                ['128k', '128K+'],
                ['1m', '1M+'],
              ] as Array<[Ctx, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" className="chip" dir={id === 'any' ? undefined : 'ltr'} aria-pressed={ctx === id} onClick={() => setCtx(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: 18 }}>
          <div className="lbl">{isFa ? 'مطمئن نیستید کدام مدل؟' : 'Not sure which?'}</div>
          <p style={{ margin: '8px 0 14px', fontSize: 14, color: 'var(--vg-ink2)', lineHeight: isFa ? 1.7 : undefined }}>
            {isFa ? (
              <>
                از{' '}
                <span className="mn" dir="ltr" style={{ color: 'var(--vg-ink)' }}>
                  vigas/auto
                </span>{' '}
                استفاده کنید تا هر درخواست خودکار بر اساس قیمت، سرعت یا کیفیت مسیریابی شود.
              </>
            ) : (
              <>
                Use <span className="mn" style={{ color: 'var(--vg-ink)' }}>vigas/auto</span> and we route each request by price, speed or quality.
              </>
            )}
          </p>
          <Link href="/leaderboard" className="link-arrow">
            {isFa ? 'مقایسه در لیدربورد' : 'Compare on the leaderboard'}
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      </aside>

      <div style={{ flex: '999 1 640px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label className="field" style={{ flex: '1 1 240px', minWidth: 0, height: 46 }}>
            <Icon name="search" size={17} />
            <span className="sr-only">{isFa ? 'جستجوی مدل‌ها' : 'Search models'}</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                isFa
                  ? `جستجوی ${toFaDigits(models.length)} مدل بر اساس نام، آزمایشگاه یا شناسه`
                  : `Search ${models.length} models by name, provider or ID`
              }
              style={{ font: `15px ${isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-sans)'}` }}
            />
          </label>
          <button
            type="button"
            className="btn gh models-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="models-filters-panel"
            onClick={() => setFiltersOpen((v) => !v)}
            style={{ minHeight: 46, padding: '0 14px', borderRadius: 12 }}
          >
            {isFa ? 'فیلترها' : 'Filters'}
            {activeFilterCount > 0 ? ` (${isFa ? toFaDigits(activeFilterCount) : activeFilterCount})` : ''}
            <Icon name={filtersOpen ? 'x' : 'chevDown'} size={15} />
          </button>
          <div role="group" aria-label={isFa ? 'دسته‌بندی' : 'Category'} className="scroll-x" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '100%' }}>
            {CATS.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                {isFa ? c.fa : c.en}
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--vg-line)', borderRadius: 20, overflow: 'hidden', background: 'var(--vg-surface)' }}>
          <div className="models-desktop tablewrap">
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
              <caption className="sr-only">{isFa ? 'مدل‌های هوش مصنوعی با پنجره متنی و قیمت هر ۱ میلیون توکن' : 'AI models with context window and price per 1M tokens'}</caption>
              <colgroup>
                <col />
                <col style={{ width: 94 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 196 }} />
              </colgroup>
              <thead>
                <tr
                  className={isFa ? 'fa-ui' : 'mn'}
                  style={{
                    background: 'var(--vg-bg2)',
                    fontSize: 12,
                    color: 'var(--vg-ink3)',
                    textTransform: isFa ? 'none' : 'uppercase',
                    letterSpacing: isFa ? 0 : '.07em',
                  }}
                >
                  <th scope="col" style={th('start')}>
                    {isFa ? 'مدل' : 'Model'}
                  </th>
                  <th scope="col" style={th()}>
                    {isFa ? 'کانتکست' : 'Context'}
                  </th>
                  <th scope="col" style={th()}>
                    {isFa ? 'ورودی / ۱M' : 'Input / 1M'}
                  </th>
                  <th scope="col" style={th()}>
                    {isFa ? 'خروجی / ۱M' : 'Output / 1M'}
                  </th>
                  <th scope="col" style={th()}>
                    {isFa ? '۲۴ ساعت' : '24h'}
                  </th>
                  <th scope="col" style={th()}>
                    <span className="sr-only">{isFa ? 'عملیات' : 'Actions'}</span>
                    <span aria-hidden="true">API</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const chg =
                    m.priceChange24h < 0
                      ? { t: `▼ ${Math.abs(m.priceChange24h)}%`, c: 'var(--vg-green)' }
                      : m.priceChange24h > 0
                        ? { t: `▲ ${m.priceChange24h}%`, c: 'var(--vg-red)' }
                        : { t: '—', c: 'var(--vg-ink3)' };
                  return (
                    <tr key={m.id} className="hov" style={{ borderTop: '1px solid var(--vg-line-soft)' }}>
                      <th scope="row" style={{ ...td('start'), fontWeight: 400 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <OrgMark org={m.org} size={34} radius={10} fontSize={16} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <b dir="ltr" style={{ fontWeight: 500 }}>
                                {m.name}
                              </b>
                              {m.tags.map((t) => (
                                <span key={t} className="mn" style={{ fontSize: 12, padding: '1px 6px', borderRadius: 5, background: 'var(--vg-raised)', color: 'var(--vg-ink2)' }}>
                                  {isFa ? (FA_TAGS[t] ?? t) : t}
                                </span>
                              ))}
                            </div>
                            <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : undefined }}>
                              {m.id}
                            </div>
                          </div>
                        </div>
                      </th>
                      <td className="mn" dir="ltr" style={{ ...td(), fontSize: 13, color: 'var(--vg-ink2)', textAlign: isFa ? 'left' : 'right' }}>
                        {formatContext(m.contextLength)}
                      </td>
                      <td className="mn" dir={isFa && m.inputPerMillionMicros === 0 ? 'rtl' : 'ltr'} style={{ ...td(), fontSize: 13, textAlign: isFa ? 'left' : 'right' }}>
                        {priceLabel(m.inputPerMillionMicros)}
                      </td>
                      <td className="mn" dir={isFa && m.outputPerMillionMicros === 0 ? 'rtl' : 'ltr'} style={{ ...td(), fontSize: 13, textAlign: isFa ? 'left' : 'right' }}>
                        {priceLabel(m.outputPerMillionMicros)}
                      </td>
                      <td className="mn" dir="ltr" style={{ ...td(), fontSize: 12, color: chg.c, textAlign: isFa ? 'left' : 'right' }}>
                        {chg.t}
                      </td>
                      <td style={td()}>
                        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <a
                            href="#quickstart"
                            className="btn gh"
                            style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
                            aria-label={isFa ? `استفاده از ${m.name} با Vigas API` : `Use ${m.name} via Vigas API`}
                          >
                            {isFa ? 'کد API' : 'Use API'}
                          </a>
                          <CopyButton
                            text={m.id}
                            label={isFa ? `کپی شناسه ${m.id}` : `Copy model ID ${m.id}`}
                            copiedText={isFa ? 'کپی شد' : 'Copied'}
                            style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
                          >
                            {isFa ? 'کپی شناسه' : 'Copy ID'}
                          </CopyButton>
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

          <div className="models-mobile">
            {rows.map((m, idx) => {
              const chg =
                m.priceChange24h < 0
                  ? { t: `▼ ${Math.abs(m.priceChange24h)}%`, c: 'var(--vg-green)' }
                  : m.priceChange24h > 0
                    ? { t: `▲ ${m.priceChange24h}%`, c: 'var(--vg-red)' }
                    : { t: '—', c: 'var(--vg-ink3)' };
              return (
                <div key={m.id} style={{ padding: '14px 16px', borderTop: idx ? '1px solid var(--vg-line-soft)' : undefined, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <OrgMark org={m.org} size={34} radius={10} fontSize={16} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b dir="ltr" style={{ display: 'block', fontWeight: 500, fontSize: 15, textAlign: isFa ? 'right' : undefined }}>
                        {m.name}
                      </b>
                      <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : undefined }}>
                        {m.id}
                      </div>
                    </div>
                  </div>
                  <div className="mn" dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, fontSize: 12, padding: '8px 10px', borderRadius: 10, background: 'var(--vg-bg2)' }}>
                    <div>
                      <span className={isFa ? 'fa-ui' : undefined} style={{ display: 'block', color: 'var(--vg-ink3)', fontSize: 10 }}>
                        {isFa ? 'کانتکست' : 'CTX'}
                      </span>
                      {formatContext(m.contextLength)}
                    </div>
                    <div>
                      <span className={isFa ? 'fa-ui' : undefined} style={{ display: 'block', color: 'var(--vg-ink3)', fontSize: 10 }}>
                        {isFa ? 'ورودی/۱M' : 'IN/1M'}
                      </span>
                      {priceLabel(m.inputPerMillionMicros)}
                    </div>
                    <div>
                      <span className={isFa ? 'fa-ui' : undefined} style={{ display: 'block', color: 'var(--vg-ink3)', fontSize: 10 }}>
                        {isFa ? 'خروجی/۱M' : 'OUT/1M'}
                      </span>
                      {priceLabel(m.outputPerMillionMicros)}
                    </div>
                    <div>
                      <span className={isFa ? 'fa-ui' : undefined} style={{ display: 'block', color: 'var(--vg-ink3)', fontSize: 10 }}>
                        {isFa ? '۲۴ ساعت' : '24H'}
                      </span>
                      <span style={{ color: chg.c }}>{chg.t}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginInlineEnd: 'auto' }}>
                      {m.tags.map((t) => (
                        <span key={t} className="mn" style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, background: 'var(--vg-raised)', color: 'var(--vg-ink2)' }}>
                          {isFa ? (FA_TAGS[t] ?? t) : t}
                        </span>
                      ))}
                    </div>
                    <a
                      href="#quickstart"
                      className="btn gh"
                      style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
                      aria-label={isFa ? `استفاده از ${m.name} با Vigas API` : `Use ${m.name} via Vigas API`}
                    >
                      {isFa ? 'کد API' : 'Use API'}
                    </a>
                    <CopyButton
                      text={m.id}
                      label={isFa ? `کپی شناسه ${m.id}` : `Copy model ID ${m.id}`}
                      copiedText={isFa ? 'کپی شد' : 'Copied'}
                      style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
                    >
                      {isFa ? 'کپی شناسه' : 'Copy ID'}
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
      </div>
    </section>
  );
}

function th(align: 'start' | 'end' = 'end'): CSSProperties {
  return { padding: '12px 20px', textAlign: align, fontWeight: 500 };
}
function td(align: 'start' | 'end' = 'end'): CSSProperties {
  return { padding: '14px 20px', textAlign: align, verticalAlign: 'middle' };
}
