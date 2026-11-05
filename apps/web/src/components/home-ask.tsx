'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './ui';

const SUGGESTIONS = ['Compare the top two models on the leaderboard', 'Cheapest model for long PDFs', 'AI news in 60 seconds'];

/** Hero prompt box: hands the question to Vigas Chat. */
export function HomeAsk({ models }: { models: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [model, setModel] = useState('vigas/auto');
  const submit = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (model !== 'vigas/auto') params.set('model', model);
    const s = params.toString();
    router.push(s ? `/chat?${s}` : '/chat');
  };
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          marginTop: 32,
          background: 'var(--vg-surface)',
          border: '1px solid var(--vg-line2)',
          borderRadius: 20,
          padding: 8,
          boxShadow: '0 30px 60px -30px rgba(0,0,0,.75)',
          maxWidth: 620,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 10px' }}>
          <Icon name="spark" size={20} style={{ color: 'var(--vg-orange)' }} />
          <span className="sr-only">Ask Vigas anything</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask Vigas anything — models, prices, news, tools…"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--vg-ink)', font: '16px var(--vg-font-sans)' }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, flexWrap: 'wrap' }}>
          <label className="chip" style={{ position: 'relative', paddingRight: 34 }}>
            <span className="sr-only">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mn"
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 0,
                color: 'var(--vg-ink)',
                fontSize: 12,
                cursor: 'pointer',
                maxWidth: 190,
              }}
            >
              <option value="vigas/auto">vigas/auto</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
            <Icon name="chevDown" size={14} style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
          </label>
          <span className="chip" style={{ cursor: 'default' }}>
            <Icon name="arena" size={14} />
            Arena mode in Chat
          </span>
          <button type="submit" className="btn key" style={{ marginLeft: 'auto', minHeight: 40 }}>
            Ask Vigas
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => setQ(s)}>
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
