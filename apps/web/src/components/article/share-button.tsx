'use client';

import { useState } from 'react';
import { Icon } from '../ui';

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link', url);
    }
  };
  return (
    <button type="button" className="ib boxed" onClick={share} aria-label={copied ? 'Link copied' : 'Share this story'} title={copied ? 'Link copied' : 'Share'}>
      <Icon name={copied ? 'check' : 'share'} size={17} style={copied ? { color: 'var(--vg-green)' } : undefined} />
    </button>
  );
}
