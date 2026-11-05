'use client';

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';

export interface EditableTool {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  pricing: 'Free' | 'Freemium' | 'Paid';
  rating: number;
  color: string;
  letter: string;
  url: string;
  runsOnVigas: boolean;
  isNew: boolean;
}

const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--vg-ink2)', marginBottom: 6 };

export function ToolEditor({ initial, categories }: { initial: EditableTool | null; categories: string[] }) {
  const router = useRouter();
  const [t, setT] = useState<EditableTool>(
    initial ?? {
      slug: '',
      name: '',
      tagline: '',
      description: '',
      category: categories[0] ?? 'Agents',
      pricing: 'Freemium',
      rating: 0,
      color: '#5DB7B0',
      letter: '',
      url: 'https://',
      runsOnVigas: false,
      isNew: true,
    },
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const set = <K extends keyof EditableTool>(k: K, v: EditableTool[K]) => setT((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...t, letter: t.letter || t.name.slice(0, 1).toUpperCase() }),
      });
      const body = (await res.json()) as { slug?: string; error?: { message?: string } };
      if (!res.ok || !body.slug) throw new Error(body.error?.message ?? `Save failed (${res.status})`);
      setMsg({ kind: 'ok', text: 'Saved. The directory updates on the next visit.' });
      if (!initial) router.replace(`/admin/tools/${body.slug}`);
      router.refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete ${initial.name} from the directory?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tools/${encodeURIComponent(initial.slug)}`, { method: 'DELETE' });
    if (res.ok) {
      router.replace('/admin/tools');
      router.refresh();
    } else {
      setMsg({ kind: 'err', text: 'Delete failed.' });
      setBusy(false);
    }
  };

  const text = (k: 'name' | 'tagline' | 'url' | 'letter' | 'slug', title: string, extra?: { mono?: boolean; disabled?: boolean; max?: number }) => (
    <div>
      <label htmlFor={`tool-${k}`} style={label}>
        {title}
      </label>
      <input
        id={`tool-${k}`}
        className={`input${extra?.mono ? ' mn' : ''}`}
        value={t[k]}
        maxLength={extra?.max}
        disabled={extra?.disabled}
        onChange={(e) => set(k, k === 'slug' ? e.target.value.toLowerCase() : e.target.value)}
      />
    </div>
  );

  return (
    <div className="card" style={{ borderRadius: 20, padding: 'clamp(16px,2.4vw,24px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
      {text('name', 'Name', { max: 80 })}
      {text('slug', initial ? 'Slug (fixed)' : 'URL slug', { mono: true, disabled: !!initial, max: 96 })}
      {text('url', 'Website', { mono: true, max: 500 })}
      {text('tagline', 'Tagline', { max: 160 })}
      <div style={{ gridColumn: '1 / -1' }}>
        <label htmlFor="tool-description" style={label}>
          Review / description
        </label>
        <textarea id="tool-description" className="input" rows={5} value={t.description} maxLength={4000} onChange={(e) => set('description', e.target.value)} style={{ height: 'auto', padding: 12 }} />
      </div>
      <div>
        <label htmlFor="tool-category" style={label}>
          Category
        </label>
        <select id="tool-category" className="input" value={t.category} onChange={(e) => set('category', e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tool-pricing" style={label}>
          Pricing
        </label>
        <select id="tool-pricing" className="input" value={t.pricing} onChange={(e) => set('pricing', e.target.value as EditableTool['pricing'])}>
          <option>Free</option>
          <option>Freemium</option>
          <option>Paid</option>
        </select>
      </div>
      <div>
        <label htmlFor="tool-rating" style={label}>
          Editor rating (0–5)
        </label>
        <input id="tool-rating" className="input mn" type="number" min={0} max={5} step={0.1} value={t.rating} onChange={(e) => set('rating', Number(e.target.value))} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>{text('letter', 'Monogram', { max: 3 })}</div>
        <div>
          <label htmlFor="tool-color" style={label}>
            Color
          </label>
          <input id="tool-color" type="color" value={t.color} onChange={(e) => set('color', e.target.value.toUpperCase())} style={{ width: 52, height: 44, border: 0, background: 'none', cursor: 'pointer' }} />
        </div>
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={t.runsOnVigas} onChange={(e) => set('runsOnVigas', e.target.checked)} style={{ accentColor: 'var(--vg-orange)', width: 18, height: 18 }} />
        Works with the Vigas API
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={t.isNew} onChange={(e) => set('isNew', e.target.checked)} style={{ accentColor: 'var(--vg-orange)', width: 18, height: 18 }} />
        Show the “New” badge
      </label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn key" disabled={busy} onClick={save}>
          {initial ? 'Save changes' : 'Add tool'}
        </button>
        {initial && (
          <button type="button" className="btn gh" disabled={busy} onClick={remove} style={{ color: 'var(--vg-red)' }}>
            Delete
          </button>
        )}
        {msg && (
          <span role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 14, color: msg.kind === 'err' ? 'var(--vg-red)' : 'var(--vg-green)' }}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
