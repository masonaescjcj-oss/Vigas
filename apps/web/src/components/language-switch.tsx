'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';

export function persistLang(next: 'en' | 'fa', { notify = true }: { notify?: boolean } = {}) {
  if (typeof document === 'undefined') return;
  try {
    localStorage.setItem('vg_lang', next);
  } catch {
    // ignore storage access issues
  }
  document.cookie = `vg_lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'fa' ? 'rtl' : 'ltr';
  if (notify) window.dispatchEvent(new Event('vg-lang-change'));
}

function resolveTarget(pathname: string, search: string, nextLang: 'en' | 'fa', altHref?: string): string {
  if (pathname === '/' || pathname === '/fa') {
    return nextLang === 'fa' ? '/fa' : '/';
  }
  if (pathname === '/news' || pathname === '/news/fa') {
    return nextLang === 'fa' ? `/news/fa${search}` : `/news${search}`;
  }
  if (pathname.startsWith('/news/fa/category/')) {
    const rest = pathname.slice('/news/fa/category/'.length);
    const cat = rest.split('/')[0] ?? '';
    return nextLang === 'en' && cat ? `/news/category/${cat}` : `${pathname}${search}`;
  }
  if (pathname.startsWith('/news/category/')) {
    const rest = pathname.slice('/news/category/'.length);
    const cat = rest.split('/')[0] ?? '';
    return nextLang === 'fa' && cat ? `/news/fa/category/${cat}` : `${pathname}${search}`;
  }
  if (pathname.startsWith('/news/')) {
    if (altHref) return altHref;
    return nextLang === 'fa' ? '/news/fa' : '/news';
  }
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  return `${pathname}${search}${hash}`;
}

export function LanguageSwitch({
  lang = 'en',
  altHref,
  variant = 'header',
  onNavigate,
  targetLang,
  children,
  className,
  style,
  title,
  dir,
  langAttr,
}: {
  lang?: 'en' | 'fa';
  altHref?: string;
  variant?: 'header' | 'mobile' | 'chips' | 'link';
  onNavigate?: () => void;
  targetLang?: 'en' | 'fa';
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  dir?: 'ltr' | 'rtl';
  langAttr?: string;
}) {
  const isFa = lang === 'fa';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  const switchTo = (nextLang: 'en' | 'fa', overrideHref?: string) => {
    persistLang(nextLang, { notify: false });
    onNavigate?.();
    const pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const target = overrideHref ?? resolveTarget(pathname, search, nextLang, altHref);
    const nextUrl = new URL(target, window.location.origin);
    if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) {
      window.location.reload();
    } else {
      window.location.assign(nextUrl.pathname + nextUrl.search + nextUrl.hash);
    }
  };

  if (variant === 'link') {
    const nextLang = targetLang ?? (isFa ? 'en' : 'fa');
    const href = altHref ?? (nextLang === 'fa' ? '/fa' : '/');
    return (
      <a
        href={href}
        dir={dir}
        lang={langAttr}
        className={className}
        style={style}
        title={title}
        onClick={(e) => {
          e.preventDefault();
          switchTo(nextLang, href);
        }}
      >
        {children}
      </a>
    );
  }

  if (variant === 'mobile') {
    return (
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--vg-line)',
        }}
      >
        <button
          type="button"
          className={!isFa ? 'chip on' : 'chip'}
          aria-pressed={!isFa}
          style={{ flex: '1 1 0', justifyContent: 'center', minHeight: 34, fontSize: 12 }}
          onClick={() => switchTo('en')}
        >
          English
        </button>
        <button
          type="button"
          lang="fa"
          className={isFa ? 'chip on fa-ui' : 'chip fa-ui'}
          aria-pressed={isFa}
          style={{ flex: '1 1 0', justifyContent: 'center', minHeight: 34, fontSize: 12 }}
          onClick={() => switchTo('fa')}
        >
          فارسی
        </button>
      </div>
    );
  }

  if (variant === 'chips') {
    return (
      <div role="group" aria-label={isFa ? 'زبان مقالات' : 'Article language'} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          dir="ltr"
          lang="en"
          className="chip"
          aria-pressed={!isFa}
          style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
          onClick={() => switchTo('en', altHref && isFa ? altHref : undefined)}
        >
          English
        </button>
        <button
          type="button"
          className="chip fa-ui"
          dir="rtl"
          lang="fa"
          aria-pressed={isFa}
          style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
          onClick={() => switchTo('fa', altHref && !isFa ? altHref : undefined)}
        >
          فارسی
        </button>
      </div>
    );
  }

  return (
    <div className="hdr-lang" role="group" aria-label={isFa ? 'انتخاب زبان' : 'Language switcher'}>
      <button
        type="button"
        aria-pressed={!isFa}
        title="English"
        onClick={() => switchTo('en', isFa && altHref ? altHref : undefined)}
      >
        EN
      </button>
      <button
        type="button"
        lang="fa"
        className="fa-ui"
        aria-pressed={isFa}
        title="نسخه فارسی"
        onClick={() => switchTo('fa', !isFa && altHref ? altHref : undefined)}
      >
        فا
      </button>
    </div>
  );
}
