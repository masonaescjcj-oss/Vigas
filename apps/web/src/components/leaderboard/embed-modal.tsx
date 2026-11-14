'use client';

import { useEffect, useState } from 'react';
import { CopyButton } from '../copy-button';
import { Icon } from '../ui';

const HEIGHTS = [380, 480, 560] as const;

export function EmbedModal({
  open,
  onClose,
  category,
  categoryLabel,
  siteUrl,
}: {
  open: boolean;
  onClose: () => void;
  category: string;
  categoryLabel: string;
  siteUrl: string;
}) {
  const [height, setHeight] = useState<number>(480);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const embedPath = category === 'overall' ? '/embed/leaderboard' : `/embed/leaderboard?category=${encodeURIComponent(category)}`;
  const boardPath = category === 'overall' ? '/leaderboard' : `/leaderboard/${encodeURIComponent(category)}`;
  const embedSrc = `${siteUrl}${embedPath}`;
  const boardHref = `${siteUrl}${boardPath}`;

  const iframeCode = `<iframe src="${embedSrc}" title="Vigas ${categoryLabel} AI Leaderboard" width="100%" height="${height}" loading="lazy" style="border:1px solid rgba(239,234,225,0.14);border-radius:16px;background:#12110F;"></iframe>\n<p style="font-size:12px;margin-top:6px;">Live data by <a href="${boardHref}">Vigas ${categoryLabel} AI Leaderboard</a></p>`;

  return (
    <div
      className="vg-modal-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="vg-modal" role="dialog" aria-modal="true" aria-labelledby="embed-modal-title">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div className="lbl">Embed · {categoryLabel}</div>
            <h3 id="embed-modal-title" className="sf" style={{ fontSize: 30, margin: '4px 0 0', fontWeight: 400 }}>
              Embed this leaderboard
            </h3>
          </div>
          <button type="button" className="ib boxed" aria-label="Close embed dialog" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--vg-ink2)' }}>
          Drop live Vigas Arena rankings into docs, blog posts, or internal dashboards. The widget refreshes automatically with the latest scores and win shares.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="lbl">Widget height</span>
          <div role="group" aria-label="Iframe height" style={{ display: 'flex', gap: 6 }}>
            {HEIGHTS.map((h) => (
              <button key={h} type="button" className="chip" aria-pressed={height === h} onClick={() => setHeight(h)} style={{ minHeight: 32, padding: '0 12px' }}>
                {h}px
              </button>
            ))}
          </div>
        </div>

        <pre
          className="mn"
          style={{
            margin: 0,
            padding: 14,
            borderRadius: 12,
            background: 'var(--vg-code)',
            border: '1px solid var(--vg-line)',
            fontSize: 12,
            lineHeight: 1.65,
            color: '#D9D3C7',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {iframeCode}
        </pre>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <a href={embedPath} target="_blank" rel="noopener noreferrer" className="link-arrow" style={{ fontSize: 13 }}>
            Preview widget in new tab
            <Icon name="external" size={14} />
          </a>
          <CopyButton text={iframeCode} label="Copy embed HTML snippet" className="btn key" style={{ minHeight: 40 }}>
            Copy embed code
          </CopyButton>
        </div>
      </div>
    </div>
  );
}
