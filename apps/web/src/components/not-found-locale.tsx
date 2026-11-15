'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('vg-lang-change', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('vg-lang-change', cb);
    window.removeEventListener('storage', cb);
  };
}

function readClientLang(): 'en' | 'fa' {
  if (typeof document === 'undefined') return 'en';
  if (document.documentElement.lang === 'fa') return 'fa';
  const match = document.cookie.match(/(?:^|;\s*)vg_lang=(fa|en)(?:;|$)/);
  if (match) return match[1] === 'fa' ? 'fa' : 'en';
  try {
    if (localStorage.getItem('vg_lang') === 'fa') return 'fa';
  } catch {
    // ignore storage access issues
  }
  return 'en';
}

export function NotFoundLocale({ en, fa }: { en: ReactNode; fa: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readClientLang, () => 'en' as const);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  return <>{lang === 'fa' ? fa : en}</>;
}
