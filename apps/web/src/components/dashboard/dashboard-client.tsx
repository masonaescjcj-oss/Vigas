'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError } from '@vigas/api-client';
import type { ApiKeySummary, AppError, CreatedApiKey, PublicUser, WalletResponse } from '@vigas/core';
import { formatUsd, shortDay } from '@/lib/fmt';
import { api, notifyAuthChanged } from '@/lib/client/session';
import { CopyButton } from '../copy-button';
import { Icon } from '../ui';

const PRESETS = [5, 10, 25, 50, 100];
const FREE_ALLOWANCE = 5_000_000;
const SOURCE_LABEL: Record<string, string> = { api: 'API', chat: 'Vigas Chat', arena: 'Arena', retrobuild: 'RetroBuild' };
const SOURCE_COLOR: Record<string, string> = { api: 'var(--vg-orange)', chat: 'var(--vg-sand)', arena: 'var(--vg-indigo)', retrobuild: 'var(--vg-teal)' };

/** Same rule as quoteTopup in @vigas/core: the first $5 of lifetime top-ups is fee-free. */
function quote(amountMicros: number, lifetime: number, feeBps: number) {
  const free = Math.min(amountMicros, Math.max(0, FREE_ALLOWANCE - lifetime));
  const fee = Math.ceil(((amountMicros - free) * feeBps) / 10_000);
  return { fee, total: amountMicros + fee };
}

async function createKey(name: string, monthlyLimitMicros: number | null): Promise<CreatedApiKey> {
  const res = await fetch('/api/app/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, ...(monthlyLimitMicros ? { monthlyLimitMicros } : {}) }),
  });
  const body = (await res.json().catch(() => null)) as (CreatedApiKey & Partial<AppError>) | null;
  if (!res.ok || !body) throw new ApiError(res.status, body?.error?.code ?? 'error', body?.error?.message ?? `HTTP ${res.status}`);
  return body;
}

export function DashboardClient({ user, initial, paymentsEnabled }: { user: PublicUser; initial: WalletResponse; paymentsEnabled: boolean }) {
  const router = useRouter();
  const ids = useId();
  const [wallet, setWallet] = useState(initial);
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keyName, setKeyName] = useState('');
  const [keyLimit, setKeyLimit] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get('topup'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselect the amount chosen on the Models page
    if (Number.isFinite(t) && t >= 1 && t <= 1000) setAmount(Math.round(t));
  }, []);

  const refresh = async () => {
    try {
      setWallet(await api.wallet());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace('/signin?next=/dashboard');
    }
  };

  const amountUsd = custom ? Number(custom) : amount;
  const amountValid = Number.isFinite(amountUsd) && amountUsd >= 1 && amountUsd <= 1000;
  const amountMicros = amountValid ? Math.round(amountUsd * 100) * 10_000 : 0;
  const q = quote(amountMicros, wallet.lifetimeTopupMicros, wallet.feeBps);

  const topup = async () => {
    if (!amountValid || topupBusy) return;
    setTopupBusy(true);
    setTopupMsg(null);
    try {
      const r = await api.topup(amountMicros);
      setTopupMsg({ ok: true, text: `Added ${formatUsd(amountMicros)}. Charged ${formatUsd(r.chargedMicros)}${r.feeMicros ? ` (incl. ${formatUsd(r.feeMicros)} fee)` : ''}.` });
      setCustom('');
      await refresh();
    } catch (e) {
      setTopupMsg({ ok: false, text: e instanceof Error ? e.message : 'Top-up failed.' });
    } finally {
      setTopupBusy(false);
    }
  };

  const onCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    if (keyBusy) return;
    const name = keyName.trim();
    if (!name) {
      setKeyErr('Give the key a name, e.g. “Production server”.');
      return;
    }
    const limitUsd = keyLimit.trim() ? Number(keyLimit) : null;
    if (limitUsd !== null && !(Number.isFinite(limitUsd) && limitUsd >= 1 && limitUsd <= 100_000)) {
      setKeyErr('Monthly limit must be between $1 and $100,000, or empty for no limit.');
      return;
    }
    setKeyBusy(true);
    setKeyErr(null);
    try {
      const k = await createKey(name, limitUsd ? Math.round(limitUsd * 100) * 10_000 : null);
      setCreated(k);
      setKeyName('');
      setKeyLimit('');
      await refresh();
    } catch (err) {
      setKeyErr(err instanceof Error ? err.message : 'Could not create the key.');
    } finally {
      setKeyBusy(false);
    }
  };

  const revoke = async (k: ApiKeySummary) => {
    setRevoking(k.id);
    try {
      await api.revokeKey(k.id);
      if (created?.id === k.id) setCreated(null);
      setConfirm(null);
      await refresh();
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : 'Could not revoke the key.');
    } finally {
      setRevoking(null);
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      notifyAuthChanged();
      router.replace('/');
      router.refresh();
    }
  };

  const weekTotal = wallet.week.reduce((s, d) => s + d.costMicros, 0);
  const weekMax = Math.max(...wallet.week.map((d) => d.costMicros), 1);
  const sourceTotal = wallet.bySource.reduce((s, d) => s + d.costMicros, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '-8px 0 28px' }}>
        <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>
          Signed in as <b style={{ color: 'var(--vg-ink)', fontWeight: 500 }}>{user.name ? `${user.name} · ` : ''}{user.email}</b>
        </p>
        <button type="button" className="btn gh" onClick={signOut} style={{ minHeight: 38 }}>
          <Icon name="logout" size={16} />
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Credits */}
        <section id="credits" aria-labelledby={`${ids}-credits`} className="card" style={{ ...card, flex: '1 1 380px', scrollMarginTop: 24 }}>
          <h2 id={`${ids}-credits`} className="lbl" style={{ margin: 0 }}>
            Available credits
          </h2>
          <div className="sf" aria-live="polite" style={{ fontSize: 'clamp(52px,6vw,72px)', lineHeight: 1, letterSpacing: '-.03em', margin: '10px 0 6px' }}>
            {formatUsd(wallet.balanceMicros)}
          </div>
          <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {formatUsd(wallet.lifetimeTopupMicros)} added in total · fee {wallet.feeBps / 100}% after the first $5
          </div>
          <div role="group" aria-label="Top-up amount" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, margin: '18px 0 10px' }}>
            {PRESETS.map((a) => {
              const on = !custom && amount === a;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setAmount(a);
                    setCustom('');
                  }}
                  className="mn"
                  style={{
                    height: 44,
                    borderRadius: 11,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    background: on ? 'var(--vg-orange-soft)' : 'var(--vg-bg2)',
                    color: on ? 'var(--vg-orange-text)' : 'var(--vg-ink)',
                    border: `1px solid ${on ? 'var(--vg-orange)' : 'var(--vg-line2)'}`,
                  }}
                >
                  ${a}
                </button>
              );
            })}
          </div>
          <label className="field" style={{ height: 44, marginBottom: 12 }}>
            <span className="mn" style={{ fontSize: 14 }}>
              $
            </span>
            <span className="sr-only">Custom amount in US dollars</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={1000}
              step="0.01"
              placeholder={`Other amount ($1 – $1,000), e.g. ${amount}`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              style={{ font: '14px var(--vg-font-mono)' }}
            />
          </label>
          <button type="button" className="btn key" onClick={topup} disabled={!amountValid || topupBusy || !paymentsEnabled} style={{ width: '100%', minHeight: 50, fontSize: 15 }}>
            {topupBusy ? 'Adding credits…' : amountValid ? `Add ${formatUsd(amountMicros)} in credits` : 'Enter $1 – $1,000'}
          </button>
          <p className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', textAlign: 'center', margin: '8px 0 0' }}>
            {amountValid ? (q.fee ? `You pay ${formatUsd(q.total)} · includes ${formatUsd(q.fee)} fee` : `You pay ${formatUsd(q.total)} · no fee`) : ' '}
          </p>
          <p style={{ fontSize: 13, color: 'var(--vg-ink3)', margin: '10px 0 0' }}>
            {paymentsEnabled
              ? 'Test mode: credits are added instantly and no card is charged.'
              : 'Card payments are not connected yet, so credits cannot be added right now.'}
          </p>
          {topupMsg && (
            <p role={topupMsg.ok ? 'status' : 'alert'} className={`notice ${topupMsg.ok ? 'ok' : 'err'}`} style={{ margin: '12px 0 0' }}>
              {topupMsg.text}
            </p>
          )}
        </section>

        {/* Usage */}
        <section aria-labelledby={`${ids}-usage`} className="card" style={{ ...card, flex: '1.4 1 460px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 id={`${ids}-usage`} className="sf" style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>
              Usage · last 7 days
            </h2>
            <span className="mn" style={{ fontSize: 13 }}>
              {formatUsd(weekTotal)}
            </span>
          </div>
          <ol aria-label="Spend per day" style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, borderBottom: '1px solid var(--vg-line2)' }}>
            {wallet.week.map((d, i) => {
              const last = i === wallet.week.length - 1;
              const h = d.costMicros ? Math.max(4, Math.round((d.costMicros / weekMax) * 140)) : 2;
              return (
                <li key={d.date} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span className="mn" style={{ fontSize: 11, color: last ? 'var(--vg-orange)' : 'var(--vg-ink3)', whiteSpace: 'nowrap' }}>
                    {d.costMicros ? formatUsd(d.costMicros, { maxDecimals: 4 }) : '$0'}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      width: '70%',
                      height: h,
                      borderRadius: '3px 3px 0 0',
                      background: last ? 'repeating-linear-gradient(90deg,#FF6A1A 0 5px,#C9520F 5px 6px)' : 'var(--vg-pillar)',
                    }}
                  />
                  <span className="sr-only">{shortDay(d.date)}</span>
                </li>
              );
            })}
          </ol>
          <div aria-hidden="true" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {wallet.week.map((d) => (
              <span key={d.date} className="mn" style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 11, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {shortDay(d.date)}
              </span>
            ))}
          </div>

          <h3 className="lbl" style={{ margin: '26px 0 10px' }}>
            By product · last 30 days
          </h3>
          {wallet.bySource.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)' }}>No usage yet. Calls from the API, Vigas Chat, Arena and RetroBuild show up here.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wallet.bySource.map((s) => (
                <li key={s.source} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 84px', gap: 12, alignItems: 'center', fontSize: 14 }}>
                  <span>{SOURCE_LABEL[s.source] ?? s.source}</span>
                  <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${sourceTotal ? (s.costMicros / sourceTotal) * 100 : 0}%`, background: SOURCE_COLOR[s.source] ?? 'var(--vg-blue)' }} />
                  </span>
                  <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                    {formatUsd(s.costMicros, { maxDecimals: 4 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Keys */}
      <section id="keys" aria-labelledby={`${ids}-keys`} className="card" style={{ ...card, marginTop: 16, scrollMarginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 id={`${ids}-keys`} className="sf" style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>
            API keys
          </h2>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {wallet.keys.length} active · base URL https://api.vigas.ai/v1
          </span>
        </div>

        <form onSubmit={onCreateKey} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '18px 0 6px' }}>
          <label style={{ flex: '2 1 240px', minWidth: 0 }}>
            <span style={fieldLabel}>Key name</span>
            <input className="input" value={keyName} maxLength={80} placeholder="e.g. Production server" onChange={(e) => setKeyName(e.target.value)} style={{ height: 46 }} />
          </label>
          <label style={{ flex: '1 1 180px', minWidth: 0 }}>
            <span style={fieldLabel}>
              Monthly limit <span style={{ color: 'var(--vg-ink3)' }}>(optional, $)</span>
            </span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={1}
              max={100000}
              step="0.01"
              value={keyLimit}
              placeholder="No limit"
              onChange={(e) => setKeyLimit(e.target.value)}
              style={{ height: 46, fontFamily: 'var(--vg-font-mono)' }}
            />
          </label>
          <button type="submit" className="btn key" disabled={keyBusy} style={{ minHeight: 46 }}>
            <Icon name="plus" size={16} />
            {keyBusy ? 'Creating…' : 'Create key'}
          </button>
        </form>
        {keyErr && (
          <p role="alert" className="notice err" style={{ margin: '10px 0 0' }}>
            {keyErr}
          </p>
        )}

        {created && (
          <div role="status" style={{ margin: '16px 0 4px', padding: 16, borderRadius: 14, background: 'rgba(111,207,115,.08)', border: '1px solid rgba(111,207,115,.3)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 14 }}>
              <b style={{ fontWeight: 600 }}>“{created.name}” is ready.</b> Copy it now — for your security we only show the full key once.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 6px 14px', borderRadius: 11, background: 'var(--vg-code)', border: '1px solid var(--vg-line2)' }}>
              <code className="mn" style={{ fontSize: 13, color: 'var(--vg-green)', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>
                {created.key}
              </code>
              <CopyButton text={created.key} label="Copy API key" />
            </div>
            <button type="button" className="btn gh" onClick={() => setCreated(null)} style={{ minHeight: 34, marginTop: 10, fontSize: 13 }}>
              I’ve saved it
            </button>
          </div>
        )}

        {wallet.keys.length === 0 ? (
          <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>No active keys. Create one above to call the API.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
            {wallet.keys.map((k) => {
              const limit = k.monthlyLimitMicros ?? null;
              const pct = limit ? Math.min(100, (k.spentThisMonthMicros / limit) * 100) : 0;
              return (
                <li key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(154,157,250,.15)', color: 'var(--vg-indigo)', flexShrink: 0 }}>
                    <Icon name="key" size={17} />
                  </span>
                  <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <b style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</b>
                    <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                      {k.display} · created {shortDay(k.createdAt)} · {k.lastUsedAt ? `last used ${shortDay(k.lastUsedAt)}` : 'never used'}
                    </span>
                  </span>
                  <span style={{ flex: '0 1 200px', minWidth: 140 }}>
                    <span className="mn" style={{ display: 'block', fontSize: 13, textAlign: 'right' }}>
                      {formatUsd(k.spentThisMonthMicros)}
                      {limit ? <span style={{ color: 'var(--vg-ink3)' }}> / {formatUsd(limit)}</span> : null}
                    </span>
                    <span className="mn" style={{ display: 'block', fontSize: 11, color: 'var(--vg-ink3)', textAlign: 'right' }}>
                      {limit ? 'spent / monthly limit' : 'spent this month · no limit'}
                    </span>
                    {limit ? (
                      <span aria-hidden="true" style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--vg-raised)', marginTop: 5, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--vg-red)' : 'var(--vg-orange)' }} />
                      </span>
                    ) : null}
                  </span>
                  {confirm === k.id ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => revoke(k)}
                        disabled={revoking === k.id}
                        style={{ minHeight: 36, padding: '0 12px', fontSize: 13, background: 'rgba(240,122,114,.15)', color: 'var(--vg-red)', boxShadow: 'inset 0 0 0 1px rgba(240,122,114,.4)' }}
                      >
                        {revoking === k.id ? 'Revoking…' : `Revoke “${k.name}”`}
                      </button>
                      <button type="button" className="btn gh" onClick={() => setConfirm(null)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn gh" onClick={() => setConfirm(k.id)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} aria-label={`Revoke key ${k.name}`}>
                      <Icon name="trash" size={15} />
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

const card: CSSProperties = { minWidth: 0, borderRadius: 22, padding: 24 };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--vg-ink2)' };
