'use client';

import { useState } from 'react';
import type { AdminModelRow } from '@vigas/db';

const ALL_TAGS = ['free', 'coding', 'reasoning', 'vision', 'agents'] as const;

export function ModelsManager({ initialModels }: { initialModels: AdminModelRow[] }) {
  const [models, setModels] = useState(initialModels);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Model form
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [contextLength, setContextLength] = useState('128000');
  const [inputUsd, setInputUsd] = useState('0.5');
  const [outputUsd, setOutputUsd] = useState('1.5');
  const [tags, setTags] = useState<string[]>(['agents']);
  const [auto, setAuto] = useState(false);

  // Endpoint binding form
  const [epModelId, setEpModelId] = useState('');
  const [epProvider, setEpProvider] = useState('google');
  const [epUpstream, setEpUpstream] = useState('');
  const [epInUsd, setEpInUsd] = useState('0');
  const [epOutUsd, setEpOutUsd] = useState('0');
  const [epPriority, setEpPriority] = useState('0');
  const [epEnabled, setEpEnabled] = useState(true);

  async function refresh() {
    const res = await fetch('/api/admin/models', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { models: AdminModelRow[] };
    setModels(data.models);
  }

  async function saveModel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'model',
          id,
          name,
          org,
          contextLength: Number(contextLength),
          inputUsd: Number(inputUsd),
          outputUsd: Number(outputUsd),
          tags,
          auto,
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to save model.');
        return;
      }
      await refresh();
      setEpModelId(id.trim().toLowerCase());
      setNotice(`Model "${id}" saved and synced with gateway.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveEndpoint(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'endpoint',
          modelId: epModelId,
          provider: epProvider,
          upstreamModel: epUpstream,
          inputUsd: Number(epInUsd),
          outputUsd: Number(epOutUsd),
          priority: Number(epPriority),
          enabled: epEnabled,
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to save endpoint.');
        return;
      }
      await refresh();
      setNotice(`Endpoint ${epProvider} → ${epUpstream} mapped to "${epModelId}".`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEndpoint(provider: string, modelId: string) {
    if (!confirm(`Remove endpoint ${provider} from ${modelId}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/models?provider=${encodeURIComponent(provider)}&modelId=${encodeURIComponent(modelId)}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEndpoint(ep: AdminModelRow['endpoints'][number]) {
    setBusy(true);
    try {
      await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'endpoint',
          modelId: ep.modelId,
          provider: ep.provider,
          upstreamModel: ep.upstreamModel,
          inputUsd: ep.inputUsd,
          outputUsd: ep.outputUsd,
          priority: ep.priority,
          enabled: !ep.enabled,
        }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const filtered = models.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.org.toLowerCase().includes(q) ||
      m.endpoints.some((ep) => ep.provider.includes(q) || ep.upstreamModel.toLowerCase().includes(q))
    );
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 11px',
    borderRadius: 10,
    border: '1px solid var(--vg-line2)',
    background: 'var(--vg-bg)',
    color: 'var(--vg-ink)',
    fontSize: 14,
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {notice && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-green)', color: 'var(--vg-green)', fontSize: 14 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: '11px 15px', borderRadius: 14, borderColor: 'var(--vg-red)', color: 'var(--vg-red)', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <form onSubmit={saveModel} className="card" style={{ padding: 18, borderRadius: 20, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Add / Edit Public Model</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inputStyle} placeholder="Model ID (e.g. you/express)" value={id} onChange={(e) => setId(e.target.value)} required />
            <input style={inputStyle} placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input style={inputStyle} placeholder="Org (Google, You.com…)" value={org} onChange={(e) => setOrg(e.target.value)} required />
            <input style={inputStyle} type="number" placeholder="Context length" value={contextLength} onChange={(e) => setContextLength(e.target.value)} />
            <input style={inputStyle} type="number" step="0.001" placeholder="Retail Input $/1M" value={inputUsd} onChange={(e) => setInputUsd(e.target.value)} />
            <input style={inputStyle} type="number" step="0.001" placeholder="Retail Output $/1M" value={outputUsd} onChange={(e) => setOutputUsd(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {ALL_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                >
                  {t}
                </button>
              );
            })}
            <label style={{ marginLeft: 'auto', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              vigas/auto
            </label>
          </div>
          <button type="submit" className="btn key" disabled={busy}>
            Save Model
          </button>
        </form>

        <form onSubmit={saveEndpoint} className="card" style={{ padding: 18, borderRadius: 20, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Bind Provider Endpoint</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inputStyle} placeholder="Vigas Model ID" value={epModelId} onChange={(e) => setEpModelId(e.target.value)} required />
            <input style={inputStyle} placeholder="Provider slug (google, you, sevenapi)" value={epProvider} onChange={(e) => setEpProvider(e.target.value)} required />
            <input style={inputStyle} placeholder="Upstream model name" value={epUpstream} onChange={(e) => setEpUpstream(e.target.value)} required />
            <input style={inputStyle} type="number" placeholder="Priority (0 = first)" value={epPriority} onChange={(e) => setEpPriority(e.target.value)} />
            <input style={inputStyle} type="number" step="0.001" placeholder="Wholesale In $/1M" value={epInUsd} onChange={(e) => setEpInUsd(e.target.value)} />
            <input style={inputStyle} type="number" step="0.001" placeholder="Wholesale Out $/1M" value={epOutUsd} onChange={(e) => setEpOutUsd(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={epEnabled} onChange={(e) => setEpEnabled(e.target.checked)} />
              Endpoint enabled
            </label>
            <button type="submit" className="btn key" disabled={busy}>
              Save Endpoint
            </button>
          </div>
        </form>
      </div>

      {/* Catalog Table */}
      <div className="card" style={{ padding: 18, borderRadius: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="mn" style={{ fontSize: 13, color: 'var(--vg-ink2)' }}>
            Showing {filtered.length} of {models.length} models
          </div>
          <input
            style={{ ...inputStyle, maxWidth: 320 }}
            placeholder="Filter by model, org, or provider…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 740 }}>
            <thead>
              <tr className="mn" style={{ textAlign: 'left', color: 'var(--vg-ink3)', borderBottom: '1px solid var(--vg-line)' }}>
                <th style={{ padding: '8px 10px' }}>Model</th>
                <th style={{ padding: '8px 10px' }}>Retail ($/1M)</th>
                <th style={{ padding: '8px 10px' }}>Upstream Endpoints</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--vg-line)' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 500 }}>{m.name}</div>
                    <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                      {m.id} · {(m.contextLength / 1000).toFixed(0)}K
                    </div>
                  </td>
                  <td className="mn" style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    {m.inputUsd === 0 && m.outputUsd === 0 ? 'FREE' : `$${m.inputUsd} / $${m.outputUsd}`}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {m.endpoints.map((ep) => (
                        <span
                          key={`${ep.provider}:${ep.modelId}`}
                          className="mn"
                          style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: 'var(--vg-bg2)',
                            border: '1px solid var(--vg-line)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            opacity: ep.enabled ? 1 : 0.55,
                          }}
                        >
                          <strong style={{ color: ep.enabled ? 'var(--vg-green)' : 'var(--vg-red)' }}>{ep.provider}</strong>
                          <span>→ {ep.upstreamModel}</span>
                          <span style={{ color: 'var(--vg-ink3)' }}>
                            (${ep.inputUsd}/${ep.outputUsd})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEndpoint(ep)}
                            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--vg-indigo)', padding: 0, fontSize: 11 }}
                          >
                            {ep.enabled ? 'off' : 'on'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEndpoint(ep.provider, ep.modelId)}
                            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--vg-red)', padding: 0, fontSize: 11 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        setId(m.id);
                        setName(m.name);
                        setOrg(m.org);
                        setContextLength(String(m.contextLength));
                        setInputUsd(String(m.inputUsd));
                        setOutputUsd(String(m.outputUsd));
                        setTags(m.tags);
                        setAuto(m.auto);
                        setEpModelId(m.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
