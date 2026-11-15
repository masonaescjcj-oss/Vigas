'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from './ui';

export type ThemeMode = 'dark' | 'light';

const THEME_EVENT = 'vg-theme-change';

function readDomTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

const subscribeNoop = () => () => {};

export function applyTheme(next: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem('vg_theme', next);
  } catch {
    // ignore storage access issues
  }
  document.cookie = `vg_theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeToggle({
  variant = 'icon',
  lang = 'en',
}: {
  variant?: 'icon' | 'drawer';
  lang?: 'en' | 'fa';
}) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const theme = useSyncExternalStore(subscribeTheme, readDomTheme, () => 'dark' as ThemeMode);
  const isFa = lang === 'fa';

  const toggle = () => {
    const current = readDomTheme();
    applyTheme(current === 'light' ? 'dark' : 'light');
  };

  const label = mounted
    ? theme === 'light'
      ? isFa
        ? 'تغییر به حالت تاریک'
        : 'Switch to dark mode'
      : isFa
        ? 'تغییر به حالت روشن'
        : 'Switch to light mode'
    : isFa
      ? 'تغییر حالت روشن و تاریک'
      : 'Toggle color theme';

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={mounted ? theme === 'light' : undefined}
        className="chip"
        style={{ width: '100%', justifyContent: 'center', minHeight: 36, fontSize: 12, marginTop: 6 }}
      >
        <span className="theme-only-dark" style={{ alignItems: 'center', gap: 7 }}>
          <Icon name="sun" size={14} />
          <span>{isFa ? 'حالت روشن (Light)' : 'Switch to light mode'}</span>
        </span>
        <span className="theme-only-light" style={{ alignItems: 'center', gap: 7 }}>
          <Icon name="moon" size={14} />
          <span>{isFa ? 'حالت تاریک (Dark)' : 'Switch to dark mode'}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={mounted ? theme === 'light' : undefined}
      className="ib"
    >
      <span className="theme-only-dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sun" size={17} />
      </span>
      <span className="theme-only-light" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="moon" size={17} />
      </span>
    </button>
  );
}
