'use client';

import { useState } from 'react';
import type { AdminUpstreamProviderRow, UpstreamKeyStrategy, UpstreamProviderKind } from '@vigas/db';
import type { GatewayPoolTelemetry } from '@/lib/admin-gateway';

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
  { value: 'sticky', label: 'sticky — Pin user session (best for coding Prompt Cache)' },
  { value: 'round_robin', label: 'round_robin — Even rotation (1 → 2 → … → N)' },
  { value: 'random', label: 'random — Random healthy key per request' },
  { value: 'sequential', label: 'sequential — Drain key #1 to cap/limit, then #2…' },
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
    const res = await fetch('/api/admin/providers', { cache: 'no-store' });
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
    setError(null);
    setNotice(`Preset "${p.label}" loaded — click Save Provider to activate.`);
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
      const res = await fetch('/api/admin/providers', {
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
      const data = (await res.json()) as { error?: { message?: string }; reload?: { reloaded?: boolean } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save provider.');
        return;
      }
      await refresh();
      setNotice(
        `Provider "${slug}" saved${data.reload?.reloaded ? ' and hot-reloaded in gateway.' : ' (gateway will auto-sync within 30s).'}`,
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
      const res = await fetch(`/api/admin/providers?slug=${encodeURIComponent(targetSlug)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = (await res.json()) as { error?: { message?: string } };
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
      const res = await fetch('/api/admin/providers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerSlug,
          rawKeys,
          labelPrefix: (bulkPrefix[providerSlug] ?? '').trim() || undefined,
          budgetUsd: Number.isFinite(budgetUsd) && (budgetUsd ?? 0) > 0 ? budgetUsd : null,
        }),
      });
      const data = (await res.json()) as {
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
      await fetch('/api/admin/providers/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: nextEnabled }),
      });
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
      await fetch(`/api/admin/providers/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function forceReloadGateway() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/providers/reload', { method: 'POST' });
      const data = (await res.json()) as { reloaded?: boolean; syncedProviders?: number; totalDbKeys?: number };
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: '1px solid var(--vg-line2)',
    background: 'var(--vg-bg)',
    color: 'var(--vg-ink)',
    fontSize: 14,
  };

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {/* Gateway live sync status bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: gateway.reachable ? 'var(--vg-green)' : 'var(--vg-sand)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 500, fontSize: 14 }}>
            Gateway sync: {gateway.reachable ? 'Connected & live' : 'Standby (DB auto-syncs every 30s when gateway runs)'}
          </span>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {providers.length} DB provider(s) · {providers.reduce((n, p) => n + p.keys.filter((k) => k.enabled).length, 0)} active key(s)
          </span>
        </div>
        <button type="button" className="btn" onClick={forceReloadGateway} disabled={busy}>
          Hot-reload gateway
        </button>
      </div>

      {notice && (
        <div className="card" style={{ padding: '12px 16px', borderRadius: 14, borderColor: 'var(--vg-green)', color: 'var(--vg-green)', fontSize: 14 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: '12px 16px', borderRadius: 14, borderColor: 'var(--vg-red)', color: 'var(--vg-red)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Add / Edit Provider Card */}
      <form onSubmit={saveProvider} className="card" style={{ padding: 20, borderRadius: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Add / Edit Upstream Provider</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--vg-ink3)' }}>
              Register unlimited upstream pools (Google, You.com, SevenAPI, or custom OpenAI/Anthropic relays). Keys are encrypted with AES-256-GCM.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map((preset) => (
              <button key={preset.slug} type="button" className="chip" onClick={() => applyPreset(preset)}>
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Slug (matches endpoint provider)</span>
            <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="google | you | sevenapi | pool2" required />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Display name</span>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Gemini (Free Hydrogen)" required />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Protocol adapter</span>
            <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as UpstreamProviderKind)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Base URL</span>
            <input
              style={inputStyle}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://generativelanguage.googleapis.com/v1beta"
              required
            />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Multi-key rotation strategy</span>
            <select style={inputStyle} value={keyStrategy} onChange={(e) => setKeyStrategy(e.target.value as UpstreamKeyStrategy)}>
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
            <span style={{ color: 'var(--vg-ink2)' }}>Public masked label</span>
            <input style={inputStyle} value={publicLabel} onChange={(e) => setPublicLabel(e.target.value)} placeholder="vigas-edge" />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
          <span style={{ color: 'var(--vg-ink2)' }}>Allowed models (optional — leave blank for all models; comma-separated for strict scoping)</span>
          <input
            style={inputStyle}
            value={allowedModels}
            onChange={(e) => setAllowedModels(e.target.value)}
            placeholder="google/gemini-4-hydrogen, google/gemini-4-hydrogen:free"
          />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
              Mask upstream name/host from customers
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
          </div>
          <button type="submit" className="btn key" disabled={busy}>
            Save Provider
          </button>
        </div>
      </form>

      {/* Provider Pool Cards */}
      {providers.length === 0 ? (
        <div className="card" style={{ padding: 24, borderRadius: 20, color: 'var(--vg-ink2)', fontSize: 14 }}>
          No DB providers configured yet. Click a preset above (e.g. <strong>+ Google Gemini (Free Hydrogen)</strong> or{' '}
          <strong>+ You.com Multi-Key ($100)</strong>), save it, then bulk-paste all your API keys below it.
        </div>
      ) : (
        providers.map((p) => {
          const live = gateway.pools[p.slug];
          return (
            <div key={p.slug} className="card" style={{ padding: 20, borderRadius: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                    <span className="mn" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--vg-raised)' }}>
                      {p.slug}
                    </span>
                    <span className="mn" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--vg-raised)', color: 'var(--vg-indigo)' }}>
                      {p.kind} · {p.keyStrategy}
                    </span>
                    <span
                      className="mn"
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--vg-raised)',
                        color: p.enabled ? 'var(--vg-green)' : 'var(--vg-red)',
                      }}
                    >
                      {p.enabled ? 'active' : 'disabled'}
                    </span>
                  </div>
                  <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 4 }}>
                    {p.baseUrl}
                    {p.allowedModels ? ` · allowed: ${p.allowedModels.join(', ')}` : ' · allowed: all mapped models'}
                  </div>
                  {live && (
                    <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink2)', marginTop: 6 }}>
                      Live pool: <strong style={{ color: 'var(--vg-green)' }}>{live.healthy} healthy</strong> · {live.coolingDown} cooling ·{' '}
                      {live.exhausted} exhausted · {live.budgetCapped} budget-capped (total {live.total})
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn" onClick={() => editProvider(p)}>
                    Edit
                  </button>
                  <button type="button" className="btn" style={{ color: 'var(--vg-red)' }} onClick={() => deleteProvider(p.slug)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Bulk Paste Multi-Keys */}
              <div style={{ padding: 14, borderRadius: 14, background: 'var(--vg-bg2)', display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Bulk add API keys (separate by newline, comma, or `/`)</div>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }}
                  placeholder="AQ.Ab8... / AQ.Ab8... / AIzaSy...  (or one key per line)"
                  value={bulkText[p.slug] ?? ''}
                  onChange={(e) => setBulkText((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, width: 170 }}
                    placeholder="Label prefix (optional)"
                    value={bulkPrefix[p.slug] ?? ''}
                    onChange={(e) => setBulkPrefix((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={{ ...inputStyle, width: 180 }}
                    placeholder="Per-key budget USD (e.g. 100)"
                    value={bulkBudget[p.slug] ?? ''}
                    onChange={(e) => setBulkBudget((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                  />
                  <button type="button" className="btn key" onClick={() => addBulkKeys(p.slug)} disabled={busy}>
                    + Add & Activate Keys
                  </button>
                </div>
              </div>

              {/* Stored Keys Table */}
              {p.keys.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
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
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  background: 'var(--vg-raised)',
                                  color: !k.enabled
                                    ? 'var(--vg-ink3)'
                                    : liveKey?.status === 'exhausted' || liveKey?.status === 'budget_capped'
                                      ? 'var(--vg-red)'
                                      : liveKey?.status === 'cooling_down'
                                        ? 'var(--vg-sand)'
                                        : 'var(--vg-green)',
                                }}
                              >
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
                              <button type="button" className="chip" style={{ color: 'var(--vg-red)' }} onClick={() => removeKey(k.id)} disabled={busy}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
