'use client';

import { useState } from 'react';
import type { AdminUpstreamProviderRow, UpstreamKeyStrategy, UpstreamProviderKind } from '@vigas/db';
import type { GatewayPoolTelemetry } from '@/lib/admin-gateway';
import { adminFetch } from '@/lib/client/admin-fetch';
import { Icon } from '../ui';

interface Props {
  initialProviders: AdminUpstreamProviderRow[];
  initialGateway: { reachable: boolean; pools: Record<string, GatewayPoolTelemetry> };
}

const PRESETS: Array<{
  label: string;
  slug: string;
  name: string;
  kind: UpstreamProviderKind;
  baseUrl: string;
  keyStrategy: UpstreamKeyStrategy;
  allowedModels: string;
  defaultBudget: string;
}> = [
  {
    label: 'Google Gemini (Free Hydrogen)',
    slug: 'google',
    name: 'Google Gemini (Free Hydrogen)',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyStrategy: 'sticky',
    allowedModels: 'google/gemini-4-hydrogen, google/gemini-4-hydrogen:free',
    defaultBudget: '',
  },
  {
    label: 'You.com Multi-Key ($100)',
    slug: 'you',
    name: 'You.com Agents Pool',
    kind: 'youcom',
    baseUrl: 'https://api.you.com',
    keyStrategy: 'round_robin',
    allowedModels: '',
    defaultBudget: '100',
  },
  {
    label: 'SevenAPI Relay (7api.st)',
    slug: 'sevenapi',
    name: 'SevenAPI Relay',
    kind: 'anthropic',
    baseUrl: 'https://7api.st',
    keyStrategy: 'sticky',
    allowedModels: '',
    defaultBudget: '',
  },
  {
    label: 'Custom OpenAI Pool',
    slug: 'pool_custom',
    name: 'Custom OpenAI Pool',
    kind: 'openai',
    baseUrl: 'https://api.example.com/v1',
    keyStrategy: 'round_robin',
    allowedModels: '',
    defaultBudget: '',
  },
];

const STRATEGIES: Array<{ value: UpstreamKeyStrategy; label: string }> = [
  { value: 'sticky', label: 'sticky — Pin user session (Prompt Cache)' },
  { value: 'round_robin', label: 'round_robin — Even rotation (1 → 2 → … → N)' },
  { value: 'random', label: 'random — Random healthy key per request' },
  { value: 'sequential', label: 'sequential — Drain key #1, then #2…' },
  { value: 'least_used', label: 'least_used — Lowest active load & usage' },
];

const KINDS: Array<{ value: UpstreamProviderKind; label: string }> = [
  { value: 'gemini', label: 'Google Gemini Native (AIza + AQ. keys)' },
  { value: 'youcom', label: 'You.com Agents API (/v1/agents/runs)' },
  { value: 'anthropic', label: 'Anthropic Messages (/v1/messages)' },
  { value: 'openai', label: 'OpenAI-Compatible (/chat/completions)' },
];

export function ProvidersManager({ initialProviders, initialGateway }: Props) {
  const [providers, setProviders] = useState(initialProviders);
  const [gateway, setGateway] = useState(initialGateway);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(initialProviders.length === 0);

  // Provider form state
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<UpstreamProviderKind>('gemini');
  const [baseUrl, setBaseUrl] = useState('');
  const [keyStrategy, setKeyStrategy] = useState<UpstreamKeyStrategy>('sticky');
  const [allowedModels, setAllowedModels] = useState('');
  const [publicLabel, setPublicLabel] = useState('vigas-edge');
  const [hidden, setHidden] = useState(true);
  const [enabled, setEnabled] = useState(true);

  // Per-provider bulk key inputs
  const [bulkText, setBulkText] = useState<Record<string, string>>({});
  const [bulkBudget, setBulkBudget] = useState<Record<string, string>>({});
  const [bulkPrefix, setBulkPrefix] = useState<Record<string, string>>({});

  async function refresh() {
    const res = await adminFetch('/api/admin/providers');
    if (!res.ok) return;
    const data = (await res.json()) as { providers: AdminUpstreamProviderRow[]; gateway: typeof gateway };
    setProviders(data.providers);
    setGateway(data.gateway);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setSlug(p.slug);
    setName(p.name);
    setKind(p.kind);
    setBaseUrl(p.baseUrl);
    setKeyStrategy(p.keyStrategy);
    setAllowedModels(p.allowedModels);
    setPublicLabel('vigas-edge');
    setHidden(true);
    setEnabled(true);
    setFormOpen(true);
    setError(null);
    setNotice(`Preset "${p.label}" loaded — tap Save Provider to activate.`);
  }

  function editProvider(p: AdminUpstreamProviderRow) {
    setSlug(p.slug);
    setName(p.name);
    setKind(p.kind);
    setBaseUrl(p.baseUrl);
    setKeyStrategy(p.keyStrategy);
    setAllowedModels(p.allowedModels?.join(', ') ?? '');
    setPublicLabel(p.publicLabel);
    setHidden(p.hidden);
    setEnabled(p.enabled);
    setFormOpen(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const modelsList = allowedModels
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await adminFetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          kind,
          baseUrl,
          keyStrategy,
          allowedModels: modelsList.length ? modelsList : null,
          hidden,
          publicLabel,
          enabled,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string }; reload?: { reloaded?: boolean } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save provider.');
        return;
      }
      await refresh();
      setNotice(
        `Provider "${slug}" saved${data.reload?.reloaded ? ' and hot-reloaded in gateway.' : ' (gateway auto-syncs within 30s).'}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteProvider(targetSlug: string) {
    if (!confirm(`Delete provider "${targetSlug}" and all of its stored keys?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/providers?slug=${encodeURIComponent(targetSlug)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(d.error?.message ?? 'Delete failed.');
        return;
      }
      await refresh();
      setNotice(`Deleted provider "${targetSlug}".`);
    } finally {
      setBusy(false);
    }
  }

  async function addBulkKeys(providerSlug: string) {
    const rawKeys = (bulkText[providerSlug] ?? '').trim();
    if (!rawKeys) {
      setError('Paste one or more API keys first (separated by newline, comma, or /).');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const budgetStr = (bulkBudget[providerSlug] ?? '').trim();
      const budgetUsd = budgetStr ? Number(budgetStr) : null;
      const res = await adminFetch('/api/admin/providers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerSlug,
          rawKeys,
          labelPrefix: (bulkPrefix[providerSlug] ?? '').trim() || undefined,
          budgetUsd: Number.isFinite(budgetUsd) && (budgetUsd ?? 0) > 0 ? budgetUsd : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        added?: number;
        skipped?: number;
        reload?: { reloaded?: boolean };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not add keys.');
        return;
      }
      setBulkText((prev) => ({ ...prev, [providerSlug]: '' }));
      await refresh();
      setNotice(
        `Added ${data.added ?? 0} key(s) to "${providerSlug}" (${data.skipped ?? 0} duplicate skipped)${data.reload?.reloaded ? ' — live in gateway!' : '.'}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleKey(id: string, nextEnabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/providers/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: nextEnabled }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(d.error?.message ?? 'Could not update key.');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(id: string) {
    if (!confirm('Remove this upstream API key permanently?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/providers/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(d.error?.message ?? 'Could not remove key.');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function forceReloadGateway() {
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/providers/reload', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        reloaded?: boolean;
        syncedProviders?: number;
        totalDbKeys?: number;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? 'Reload failed.');
        return;
      }
      await refresh();
      setNotice(
        data.reloaded
          ? `Gateway reloaded live (${data.syncedProviders ?? 0} providers, ${data.totalDbKeys ?? 0} active keys).`
          : 'Gateway reload endpoint unreachable — check GATEWAY_URL & INTERNAL_SERVICE_TOKEN.',
      );
    } finally {
      setBusy(false);
    }
  }

  const totalActiveKeys = providers.reduce((n, p) => n + p.keys.filter((k) => k.enabled).length, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Gateway live sync & summary bar */}
      <div className="card adm-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              background: gateway.reachable ? 'var(--vg-green)' : 'var(--vg-sand)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 500, fontSize: 14 }}>
            Gateway: {gateway.reachable ? 'Connected & live' : 'Standby (30s sync)'}
          </span>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {providers.length} pool(s) · {totalActiveKeys} active key(s)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={formOpen ? 'btn gh' : 'btn key'}
            onClick={() => setFormOpen((v) => !v)}
            style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}
          >
            <Icon name={formOpen ? 'x' : 'plus'} size={15} />
            {formOpen ? 'Hide form' : 'Add provider'}
          </button>
          <button
            type="button"
            className="btn gh"
            onClick={forceReloadGateway}
            disabled={busy}
            style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}
          >
            <Icon name="refresh" size={14} />
            Reload gateway
          </button>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ padding: '12px 15px', borderRadius: 14, borderColor: 'var(--vg-green-edge)', color: 'var(--vg-green)', fontSize: 13.5 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: '12px 15px', borderRadius: 14, borderColor: 'var(--vg-red-edge)', color: 'var(--vg-red)', fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {/* Quick Presets Row */}
      <div className="scroll-x" style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
        {PRESETS.map((preset) => (
          <button key={preset.slug} type="button" className="chip" onClick={() => applyPreset(preset)}>
            + {preset.label}
          </button>
        ))}
      </div>

      {/* Collapsible Add / Edit Provider Form */}
      {formOpen && (
        <form onSubmit={saveProvider} className="card adm-form-card">
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Add / Edit Upstream Provider</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--vg-ink3)' }}>
              Register unlimited upstream pools (Google, You.com, SevenAPI, or custom OpenAI/Anthropic relays). Keys are encrypted with AES-256-GCM.
            </p>
          </div>

          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Slug (endpoint provider)</span>
              <input className="adm-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="google | you | sevenapi" required />
            </label>
            <label className="adm-field">
              <span>Display name</span>
              <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Gemini (Free Hydrogen)" required />
            </label>
            <label className="adm-field">
              <span>Protocol adapter</span>
              <select className="adm-input" value={kind} onChange={(e) => setKind(e.target.value as UpstreamProviderKind)}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Base URL</span>
              <input
                className="adm-input"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta"
                required
              />
            </label>
            <label className="adm-field">
              <span>Multi-key rotation strategy</span>
              <select className="adm-input" value={keyStrategy} onChange={(e) => setKeyStrategy(e.target.value as UpstreamKeyStrategy)}>
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Public masked label</span>
              <input className="adm-input" value={publicLabel} onChange={(e) => setPublicLabel(e.target.value)} placeholder="vigas-edge" />
            </label>
          </div>

          <label className="adm-field">
            <span>Allowed models (optional — comma-separated for strict scoping)</span>
            <input
              className="adm-input"
              value={allowedModels}
              onChange={(e) => setAllowedModels(e.target.value)}
              placeholder="google/gemini-4-hydrogen, google/gemini-4-hydrogen:free"
            />
          </label>

          <div className="adm-form-foot">
            <div style={{ display: 'flex', gap: 16, fontSize: 13.5, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
                Mask upstream host
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enabled
              </label>
            </div>
            <button type="submit" className="btn key adm-full-xs" disabled={busy}>
              Save Provider
            </button>
          </div>
        </form>
      )}

      {/* Provider Pool Cards */}
      {providers.length === 0 ? (
        <div className="card" style={{ padding: 22, borderRadius: 20, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.6 }}>
          No DB providers configured yet. Tap a preset above (e.g. <strong>+ Google Gemini (Free Hydrogen)</strong> or{' '}
          <strong>+ SevenAPI Relay</strong>), save it, then bulk-paste all your API keys below it.
        </div>
      ) : (
        providers.map((p) => {
          const live = gateway.pools[p.slug];
          return (
            <div key={p.slug} className="card adm-pool-card">
              <div className="adm-pool-head">
                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 17 }}>{p.name}</h3>
                    <span className="adm-pill subtle">{p.slug}</span>
                    <span className="adm-pill indigo">
                      {p.kind} · {p.keyStrategy}
                    </span>
                    <span className={`adm-pill ${p.enabled ? 'ok' : 'err'}`}>{p.enabled ? 'active' : 'disabled'}</span>
                  </div>
                  <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 5, overflowWrap: 'anywhere' }}>
                    {p.baseUrl}
                    {p.allowedModels ? ` · allowed: ${p.allowedModels.join(', ')}` : ' · all mapped models'}
                  </div>
                  {live && (
                    <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink2)', marginTop: 6 }}>
                      Live pool: <strong style={{ color: 'var(--vg-green)' }}>{live.healthy} healthy</strong> · {live.coolingDown} cooling ·{' '}
                      {live.exhausted} exhausted · {live.budgetCapped} capped ({live.total} total)
                    </div>
                  )}
                </div>
                <div className="adm-pool-actions">
                  <button type="button" className="btn gh" onClick={() => editProvider(p)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn gh"
                    style={{ minHeight: 36, padding: '0 12px', fontSize: 13, color: 'var(--vg-red)' }}
                    onClick={() => deleteProvider(p.slug)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Bulk Paste Multi-Keys */}
              <div className="adm-bulk-box">
                <div style={{ fontSize: 13, fontWeight: 500 }}>Bulk add API keys (newline, comma, or `/`)</div>
                <textarea
                  rows={3}
                  className="adm-input mn"
                  style={{ fontSize: 12.5, lineHeight: 1.5 }}
                  placeholder="AQ.Ab8... / AIzaSy...  (or one key per line)"
                  value={bulkText[p.slug] ?? ''}
                  onChange={(e) => setBulkText((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                />
                <div className="adm-bulk-row">
                  <input
                    className="adm-input"
                    placeholder="Label prefix (opt.)"
                    value={bulkPrefix[p.slug] ?? ''}
                    onChange={(e) => setBulkPrefix((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="adm-input"
                    placeholder="Budget USD (e.g. 100)"
                    value={bulkBudget[p.slug] ?? ''}
                    onChange={(e) => setBulkBudget((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                  />
                  <button type="button" className="btn key adm-full-xs" onClick={() => addBulkKeys(p.slug)} disabled={busy} style={{ minHeight: 40 }}>
                    + Add & Activate Keys
                  </button>
                </div>
              </div>

              {/* Stored Keys: Desktop Table */}
              {p.keys.length > 0 && (
                <>
                  <div className="adm-desktop" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr className="mn" style={{ textAlign: 'left', color: 'var(--vg-ink3)', borderBottom: '1px solid var(--vg-line)' }}>
                          <th style={{ padding: '8px 10px' }}>Label</th>
                          <th style={{ padding: '8px 10px' }}>Masked Key</th>
                          <th style={{ padding: '8px 10px' }}>Budget Cap</th>
                          <th style={{ padding: '8px 10px' }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.keys.map((k) => {
                          const liveKey = live?.keys.find((lk) => lk.label === k.label);
                          const statusTone = !k.enabled
                            ? 'subtle'
                            : liveKey?.status === 'exhausted' || liveKey?.status === 'budget_capped'
                              ? 'err'
                              : liveKey?.status === 'cooling_down'
                                ? 'warn'
                                : 'ok';
                          return (
                            <tr key={k.id} style={{ borderTop: '1px solid var(--vg-line)' }}>
                              <td className="mn" style={{ padding: '9px 10px', fontWeight: 500 }}>
                                {k.label}
                              </td>
                              <td className="mn" style={{ padding: '9px 10px', color: 'var(--vg-ink2)' }}>
                                {k.keyHint}
                              </td>
                              <td className="mn" style={{ padding: '9px 10px', color: 'var(--vg-ink2)' }}>
                                {k.budgetUsd !== null ? `$${k.budgetUsd.toFixed(2)}` : 'Unlimited'}
                                {liveKey ? ` (uses: ${liveKey.uses}, $${liveKey.spentUsd})` : ''}
                              </td>
                              <td className="mn" style={{ padding: '9px 10px' }}>
                                <span className={`adm-pill ${statusTone}`}>
                                  {!k.enabled ? 'disabled' : liveKey ? liveKey.status : 'active'}
                                  {liveKey?.cooldownRemainingSec ? ` (${liveKey.cooldownRemainingSec}s)` : ''}
                                </span>
                              </td>
                              <td style={{ padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <button
                                  type="button"
                                  className="chip"
                                  style={{ marginRight: 6 }}
                                  onClick={() => toggleKey(k.id, !k.enabled)}
                                  disabled={busy}
                                >
                                  {k.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  className="chip"
                                  style={{ color: 'var(--vg-red)' }}
                                  onClick={() => removeKey(k.id)}
                                  disabled={busy}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Stored Keys: Mobile Stacked Cards */}
                  <div className="adm-mobile-list">
                    {p.keys.map((k) => {
                      const liveKey = live?.keys.find((lk) => lk.label === k.label);
                      const statusTone = !k.enabled
                        ? 'subtle'
                        : liveKey?.status === 'exhausted' || liveKey?.status === 'budget_capped'
                          ? 'err'
                          : liveKey?.status === 'cooling_down'
                            ? 'warn'
                            : 'ok';
                      return (
                        <div key={k.id} className="adm-key-card">
                          <div className="adm-mcard-row">
                            <span className="mn" style={{ fontWeight: 600, fontSize: 13 }}>
                              {k.label}
                            </span>
                            <span className={`adm-pill ${statusTone}`}>
                              {!k.enabled ? 'disabled' : liveKey ? liveKey.status : 'active'}
                              {liveKey?.cooldownRemainingSec ? ` (${liveKey.cooldownRemainingSec}s)` : ''}
                            </span>
                          </div>
                          <div className="adm-mcard-row mn" style={{ fontSize: 12, color: 'var(--vg-ink2)' }}>
                            <span>{k.keyHint}</span>
                            <span>
                              {k.budgetUsd !== null ? `$${k.budgetUsd.toFixed(2)}` : 'Unlimited'}
                              {liveKey ? ` · ${liveKey.uses} req` : ''}
                            </span>
                          </div>
                          <div className="adm-mcard-actions">
                            <button
                              type="button"
                              className="btn gh"
                              style={{ flex: 1, minHeight: 36, fontSize: 12.5 }}
                              onClick={() => toggleKey(k.id, !k.enabled)}
                              disabled={busy}
                            >
                              {k.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              className="btn gh"
                              style={{ flex: 1, minHeight: 36, fontSize: 12.5, color: 'var(--vg-red)' }}
                              onClick={() => removeKey(k.id)}
                              disabled={busy}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
