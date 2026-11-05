'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { renderChatMarkdown } from '@/lib/markdown';

export interface EditableArticle {
  slug: string;
  title: string;
  dek: string;
  category: string;
  flag: 'Breaking' | 'Analysis' | 'Exclusive' | null;
  authorSlug: string;
  status: 'draft' | 'published';
  body: string;
  cover: { big: string; caption: string; color: string };
  faq: Array<{ q: string; a: string }>;
  mentionedModelIds: string[];
  pullQuote: { text: string; cite: string } | null;
}

const COLORS = ['#FF6A1A', '#E3B65C', '#9A9DFA', '#5DB7B0', '#6FCF73', '#5B8FD6', '#F07A72', '#EFEAE1'];

const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--vg-ink2)', marginBottom: 6 };

function Field({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={label}>
        {title} {hint && <span style={{ color: 'var(--vg-ink3)', fontWeight: 400 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function ArticleEditor({
  initial,
  authors,
  categories,
  models,
}: {
  initial: EditableArticle | null;
  authors: Array<{ slug: string; name: string }>;
  categories: string[];
  models: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [a, setA] = useState<EditableArticle>(
    initial ?? {
      slug: '',
      title: '',
      dek: '',
      category: categories[0] ?? 'Models',
      flag: null,
      authorSlug: authors[0]?.slug ?? '',
      status: 'draft',
      body: '',
      cover: { big: '', caption: '', color: COLORS[0]! },
      faq: [],
      mentionedModelIds: [],
      pullQuote: null,
    },
  );
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const set = <K extends keyof EditableArticle>(k: K, v: EditableArticle[K]) => setA((x) => ({ ...x, [k]: v }));
  const preview = useMemo(() => (tab === 'preview' ? renderChatMarkdown(a.body) : ''), [tab, a.body]);

  const save = async (status: 'draft' | 'published') => {
    setBusy(true);
    setMsg(null);
    const payload = {
      ...a,
      status,
      slug: a.slug.trim() || undefined,
      faq: a.faq.filter((f) => f.q.trim() && f.a.trim()),
      pullQuote: a.pullQuote && a.pullQuote.text.trim() ? a.pullQuote : null,
    };
    try {
      const res = await fetch(initial ? `/api/admin/articles/${encodeURIComponent(initial.slug)}` : '/api/admin/articles', {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { slug?: string; error?: { message?: string } };
      if (!res.ok || !body.slug) throw new Error(body.error?.message ?? `Save failed (${res.status})`);
      setA((x) => ({ ...x, status, slug: body.slug! }));
      setMsg({ kind: 'ok', text: status === 'published' ? 'Published. The public page updates on the next visit.' : 'Draft saved.' });
      if (!initial || initial.slug !== body.slug) router.replace(`/admin/articles/${body.slug}`);
      router.refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete “${initial.title}”? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/articles/${encodeURIComponent(initial.slug)}`, { method: 'DELETE' });
    if (res.ok) {
      router.replace('/admin');
      router.refresh();
    } else {
      setMsg({ kind: 'err', text: 'Delete failed.' });
      setBusy(false);
    }
  };

  const toggleModel = (id: string) =>
    set('mentionedModelIds', a.mentionedModelIds.includes(id) ? a.mentionedModelIds.filter((m) => m !== id) : [...a.mentionedModelIds, id]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '999 1 560px', minWidth: 0, borderRadius: 20, padding: 'clamp(16px,2.4vw,24px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field id="title" title="Headline">
          <input id="title" className="input" value={a.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field id="dek" title="Dek" hint="one sentence under the headline">
          <textarea id="dek" className="input" rows={2} value={a.dek} maxLength={400} onChange={(e) => set('dek', e.target.value)} style={{ height: 'auto', padding: 12 }} />
        </Field>
        <div>
          <div role="tablist" aria-label="Body" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['write', 'preview'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                {t === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-ink3)', alignSelf: 'center' }}>Markdown · ## for subheadings · **bold** · [link](https://…)</span>
          </div>
          {tab === 'write' ? (
            <textarea
              aria-label="Article body"
              className="input mn"
              rows={22}
              value={a.body}
              onChange={(e) => set('body', e.target.value)}
              style={{ height: 'auto', padding: 14, fontSize: 13.5, lineHeight: 1.7 }}
            />
          ) : (
            <div
              className="sf"
              style={{ minHeight: 300, padding: '8px 4px', fontSize: 19, lineHeight: 1.65, color: '#E6E0D6' }}
              // renderChatMarkdown escapes raw HTML and filters link targets.
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          )}
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ ...label, marginBottom: 10 }}>FAQ · shown at the end and sent to Google as FAQPage data</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {a.faq.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input aria-label={`Question ${i + 1}`} className="input" placeholder="Question" value={f.q} onChange={(e) => set('faq', a.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} style={{ flex: '1 1 220px' }} />
                <input aria-label={`Answer ${i + 1}`} className="input" placeholder="Answer" value={f.a} onChange={(e) => set('faq', a.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} style={{ flex: '2 1 300px' }} />
                <button type="button" className="btn gh" aria-label={`Remove question ${i + 1}`} onClick={() => set('faq', a.faq.filter((_, j) => j !== i))} style={{ minHeight: 44 }}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn gh" onClick={() => set('faq', [...a.faq, { q: '', a: '' }])} style={{ alignSelf: 'flex-start' }}>
              Add question
            </button>
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Field id="quote" title="Pull quote" hint="optional">
            <input id="quote" className="input" value={a.pullQuote?.text ?? ''} onChange={(e) => set('pullQuote', { text: e.target.value, cite: a.pullQuote?.cite ?? '' })} style={{ minWidth: 280 }} />
          </Field>
          <Field id="cite" title="Quote source">
            <input id="cite" className="input" value={a.pullQuote?.cite ?? ''} onChange={(e) => set('pullQuote', { text: a.pullQuote?.text ?? '', cite: e.target.value })} />
          </Field>
        </div>
      </div>

      <aside className="card" aria-label="Article settings" style={{ flex: '1 1 300px', minWidth: 0, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="lbl">Status</span>
          <span className="mn" style={{ fontSize: 12, color: a.status === 'published' ? 'var(--vg-green)' : 'var(--vg-sand)' }}>{a.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn gh" disabled={busy} onClick={() => save('draft')} style={{ flex: '1 1 120px' }}>
            {a.status === 'published' ? 'Unpublish' : 'Save draft'}
          </button>
          <button type="button" className="btn key" disabled={busy} onClick={() => save('published')} style={{ flex: '1 1 120px' }}>
            {a.status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
        {msg && (
          <p role={msg.kind === 'err' ? 'alert' : 'status'} style={{ margin: 0, fontSize: 14, color: msg.kind === 'err' ? 'var(--vg-red)' : 'var(--vg-green)' }}>
            {msg.text}
          </p>
        )}
        {initial?.status === 'published' && (
          <Link href={`/news/${a.slug}`} className="mn" style={{ fontSize: 12, color: 'var(--vg-indigo)' }}>
            View /news/{a.slug}
          </Link>
        )}

        <Field id="slug" title="URL slug" hint={initial ? 'changing it breaks old links' : 'leave empty to use the headline'}>
          <input id="slug" className="input mn" value={a.slug} placeholder="auto" onChange={(e) => set('slug', e.target.value.toLowerCase())} style={{ fontSize: 13 }} />
        </Field>
        <Field id="category" title="Section">
          <select id="category" className="input" value={a.category} onChange={(e) => set('category', e.target.value)}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field id="flag" title="Flag">
          <select id="flag" className="input" value={a.flag ?? ''} onChange={(e) => set('flag', (e.target.value || null) as EditableArticle['flag'])}>
            <option value="">None</option>
            <option>Breaking</option>
            <option>Analysis</option>
            <option>Exclusive</option>
          </select>
        </Field>
        <Field id="author" title="Author">
          <select id="author" className="input" value={a.authorSlug} onChange={(e) => set('authorSlug', e.target.value)}>
            {authors.map((au) => (
              <option key={au.slug} value={au.slug}>
                {au.name}
              </option>
            ))}
          </select>
        </Field>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={label}>Cover · a big figure and a caption</legend>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Cover figure" className="input sf" placeholder="−38%" maxLength={8} value={a.cover.big} onChange={(e) => set('cover', { ...a.cover, big: e.target.value })} style={{ flex: 1, fontSize: 22 }} />
            <input aria-label="Cover caption" className="input mn" placeholder="QOQ" maxLength={24} value={a.cover.caption} onChange={(e) => set('cover', { ...a.cover, caption: e.target.value.toUpperCase() })} style={{ flex: 1, fontSize: 12 }} />
          </div>
          <div role="radiogroup" aria-label="Cover color" style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={a.cover.color === c}
                aria-label={c}
                onClick={() => set('cover', { ...a.cover, color: c })}
                style={{ width: 30, height: 30, borderRadius: 8, background: c, border: a.cover.color === c ? '2px solid var(--vg-ink)' : '2px solid transparent', cursor: 'pointer' }}
              />
            ))}
          </div>
          <div aria-hidden="true" style={{ marginTop: 10, height: 96, borderRadius: 12, background: '#151411', border: '1px solid var(--vg-line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 12px' }}>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>{a.cover.caption || 'CAPTION'}</span>
            <span className="sf" style={{ fontSize: 36, lineHeight: 1, color: a.cover.color }}>{a.cover.big || 'AI'}</span>
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={label}>Models in this story · shown with live prices</legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {models.map((m) => (
              <button key={m.id} type="button" aria-pressed={a.mentionedModelIds.includes(m.id)} className={`chip${a.mentionedModelIds.includes(m.id) ? ' on' : ''}`} onClick={() => toggleModel(m.id)} style={{ minHeight: 32, fontSize: 12 }}>
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>

        {initial && (
          <button type="button" className="btn gh" disabled={busy} onClick={remove} style={{ color: 'var(--vg-red)', marginTop: 6 }}>
            Delete article
          </button>
        )}
      </aside>
    </div>
  );
}
