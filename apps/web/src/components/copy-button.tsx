'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './ui';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without the async clipboard API (or without permission).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Icon button (with `label` as its accessible name) or text button (with `children`). */
export function CopyButton({
  text,
  label,
  children,
  className,
  style,
}: {
  text: string;
  label: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };
  if (children) {
    return (
      <button type="button" className={className ?? 'btn gh'} style={style} onClick={onClick} aria-label={copied ? `${label}: copied` : label}>
        {copied ? 'Copied' : children}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={className ?? 'ib solid'}
      style={style}
      onClick={onClick}
      aria-label={copied ? `${label}: copied` : label}
      title={copied ? 'Copied' : label}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} style={copied ? { color: 'var(--vg-green)' } : undefined} />
    </button>
  );
}
