'use client';

import { useState } from 'react';
import { Icon } from '../ui';

export function ShareButton({ title, url, lang = 'en' }: { title: string; url: string; lang?: 'en' | 'fa' }) {
  const isFa = lang === 'fa';
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
      window.prompt(isFa ? 'کپی لینک مقاله' : 'Copy this link', url);
    }
  };
  return (
    <button
      type="button"
      className="ib boxed"
      onClick={share}
      aria-label={copied ? (isFa ? 'لینک کپی شد' : 'Link copied') : isFa ? 'اشتراک‌گذاری مقاله' : 'Share this story'}
      title={copied ? (isFa ? 'لینک کپی شد' : 'Link copied') : isFa ? 'اشتراک‌گذاری' : 'Share'}
    >
      <Icon name={copied ? 'check' : 'share'} size={17} style={copied ? { color: 'var(--vg-green)' } : undefined} />
    </button>
  );
}
