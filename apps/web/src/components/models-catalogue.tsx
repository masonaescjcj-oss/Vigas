'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ModelListItem, ModelTag } from '@vigas/core';
import { formatContext, formatPricePerMillion } from '@/lib/fmt';
import { CopyButton } from './copy-button';
import { Icon, Mark } from './ui';

type Cat = 'all' | ModelTag;
type Ctx = 'any' | '128k' | '1m';

const CATS: Array<[Cat, string]> = [
  ['all', 'All'],
  ['agents', 'Agents'],
  ['coding', 'Coding'],
  ['reasoning', 'Reasoning'],
  ['vision', 'Vision'],
  ['free', 'Free'],
];

export interface ProviderOption {
  name: string;
  color: string;
  letter: string;
}

export function ModelsCatalogue({
  models,
  providers,
}: {
  models: Array<ModelListItem & { color: string; letter: string }>;
  providers: ProviderOption[];
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');
  const [ctx, setCtx] = useState<Ctx>('any');
  const [off, setOff] = useState<Record<string, boolean>>({});

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
    if (tag && CATS.some(([c]) => c === tag)) setCat(tag);
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

  return (
    <section aria-label="Model catalogue" style={{ display: 'flex', flexWrap: 'wrap', gap: 28, padding: '32px 0 72px' }}>
      <aside aria-label="Filters" style={{ flex: '1 1 230px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 26 }}>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="lbl" style={{ marginBottom: 12, padding: 0 }}>
            Providers
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
                <Mark color={p.color} letter={p.letter} size={22} radius={6} fontSize={13} ring={false} />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div role="group" aria-labelledby="ctx-label">
          <div id="ctx-label" className="lbl" style={{ marginBottom: 12 }}>
            Context window
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['any', 'Any'],
                ['128k', '128K+'],
                ['1m', '1M+'],
              ] as Array<[Ctx, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" className="chip" aria-pressed={ctx === id} onClick={() => setCtx(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ borderRadius: 16, padding: 18 }}>
          <div className="lbl">Not sure which?</div>
          <p style={{ margin: '8px 0 14px', fontSize: 14, color: 'var(--vg-ink2)' }}>
            Use <span className="mn" style={{ color: 'var(--vg-ink)' }}>vigas/auto</span> and we route each request by price, speed or quality.
          </p>
          <Link href="/leaderboard" className="link-arrow">
            Compare on the leaderboard
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      </aside>

      <div style={{ flex: '999 1 640px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label className="field" style={{ flex: '1 1 260px', minWidth: 0, height: 46 }}>
            <Icon name="search" size={17} />
            <span className="sr-only">Search models</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${models.length} models by name, provider or ID`}
              style={{ font: '15px var(--vg-font-sans)' }}
            />
          </label>
          <div role="group" aria-label="Category" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATS.map(([id, label]) => (
              <button key={id} type="button" className="chip" aria-pressed={cat === id} onClick={() => setCat(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--vg-line)', borderRadius: 20, overflow: 'hidden', background: 'var(--vg-surface)' }}>
          <div className="tablewrap">
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
              <caption className="sr-only">AI models with context window and price per 1M tokens</caption>
              <colgroup>
                <col />
                <col style={{ width: 94 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr className="mn" style={{ background: 'var(--vg-bg2)', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  <th scope="col" style={th('left')}>
                    Model
                  </th>
                  <th scope="col" style={th()}>
                    Context
                  </th>
                  <th scope="col" style={th()}>
                    Input / 1M
                  </th>
                  <th scope="col" style={th()}>
                    Output / 1M
                  </th>
                  <th scope="col" style={th()}>
                    24h
                  </th>
                  <th scope="col" style={th()}>
                    <span className="sr-only">Actions</span>
                    <span aria-hidden="true">Use it</span>
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
                    <tr key={m.id} className="hov" style={{ borderTop: '1px solid rgba(239,234,225,.06)' }}>
                      <th scope="row" style={{ ...td('left'), fontWeight: 400 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <Mark color={m.color} letter={m.letter} size={34} radius={10} fontSize={16} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <b style={{ fontWeight: 500 }}>{m.name}</b>
                              {m.tags.map((t) => (
                                <span key={t} className="mn" style={{ fontSize: 12, padding: '1px 6px', borderRadius: 5, background: 'var(--vg-raised)', color: 'var(--vg-ink2)' }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.id}
                            </div>
                          </div>
                        </div>
                      </th>
                      <td className="mn" style={{ ...td(), fontSize: 13, color: 'var(--vg-ink2)' }}>
                        {formatContext(m.contextLength)}
                      </td>
                      <td className="mn" style={{ ...td(), fontSize: 13 }}>
                        {formatPricePerMillion(m.inputPerMillionMicros)}
                      </td>
                      <td className="mn" style={{ ...td(), fontSize: 13 }}>
                        {formatPricePerMillion(m.outputPerMillionMicros)}
                      </td>
                      <td className="mn" style={{ ...td(), fontSize: 12, color: chg.c }}>
                        {chg.t}
                      </td>
                      <td style={td()}>
                        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Link
                            href={`/chat?model=${encodeURIComponent(m.id)}`}
                            className="btn gh"
                            style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
                            aria-label={`Try ${m.name} in Vigas Chat`}
                          >
                            Try
                          </Link>
                          <CopyButton text={m.id} label={`Copy model ID ${m.id}`} style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}>
                            Copy ID
                          </CopyButton>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--vg-ink2)', margin: 0 }}>No models match. Try another filter.</p>
            )}
          </div>
        </div>
        <p className="mn" role="status" style={{ fontSize: 12, color: 'var(--vg-ink3)', margin: '12px 0 0' }}>
          Showing {rows.length} of {models.length} · prices refresh every 5 minutes
        </p>
      </div>
    </section>
  );
}

function th(align: 'left' | 'right' = 'right'): CSSProperties {
  return { padding: '12px 20px', textAlign: align, fontWeight: 500 };
}
function td(align: 'left' | 'right' = 'right'): CSSProperties {
  return { padding: '14px 20px', textAlign: align, verticalAlign: 'middle' };
}
