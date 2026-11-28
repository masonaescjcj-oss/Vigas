'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAdminHint } from '@/lib/client/admin-fetch';
import { useSignedInHint } from '@/lib/client/session';
import { LanguageSwitch } from './language-switch';
import { ThemeToggle } from './theme-toggle';
import { Icon, LogoMark } from './ui';

export function MobileNav({
  active,
  nav,
  lang = 'en',
  altHref,
  compact = false,
}: {
  active: string;
  nav?: ReadonlyArray<readonly [string, string, string]>;
  lang?: 'en' | 'fa';
  altHref?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const signedIn = useSignedInHint();
  const isAdmin = useAdminHint();
  const isFa = lang === 'fa';

  const close = () => setOpen(false);
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    close();
    setQuery('');
    router.push(q ? `/models?q=${encodeURIComponent(q)}` : '/models');
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const currentLabel = active === 'home' ? 'Vigas' : (nav?.find(([id]) => id === active)?.[1] ?? '');

  return (
    <>
      {compact ? (
        <button
          type="button"
          className="adm-mhdr-menu"
          aria-expanded={open}
          aria-label={isFa ? 'باز کردن منو' : 'Open navigation menu'}
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" size={18} />
        </button>
      ) : (
        <button
          type="button"
          className="hdr-menu hdr-menu-pill"
          aria-expanded={open}
          aria-label={isFa ? 'باز کردن منو' : 'Open navigation menu'}
          onClick={() => setOpen(true)}
        >
          <LogoMark size={20} />
          <span className="sf" dir="ltr" style={{ fontSize: 21, lineHeight: 1, letterSpacing: '-.01em' }}>
            Vigas
          </span>
          {currentLabel && active !== 'home' && active !== 'none' && <span className="mn hdr-menu-cur">{currentLabel}</span>}
          <Icon name="chevDown" size={14} className="hdr-menu-chev" />
        </button>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`vg-sheet-scrim${isFa ? ' fa-ui' : ''}`}
            dir={isFa ? 'rtl' : 'ltr'}
            lang={lang}
            role="dialog"
            aria-modal="true"
            aria-label={isFa ? 'منوی ناوبری ویگاس' : 'Vigas navigation menu'}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="vg-sheet">
              <div className="vg-sheet-handle" aria-hidden="true" />
              <div className="vg-sheet-head" style={{ paddingBottom: 14, borderBottom: '1px solid var(--vg-line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    className="bg-signal-grad"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                      boxShadow: '0 8px 22px rgba(255, 90, 31, .35)',
                    }}
                  >
                    {signedIn ? (isAdmin ? 'AD' : 'VG') : <Icon name="users" size={18} />}
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 16, lineHeight: 1.25 }}>
                      {signedIn ? (isFa ? 'حساب کاربری ویگاس' : 'Vigas Account') : isFa ? 'خوش آمدید به ویگاس' : 'Welcome to Vigas'}
                    </strong>
                    <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                      {isAdmin ? 'Admin · vigas.app' : 'vigas.app'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="ib boxed"
                  aria-label={isFa ? 'بستن منو' : 'Close menu'}
                  onClick={close}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              <form onSubmit={onSearch} role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', borderRadius: 999, background: 'var(--vg-surface)', border: '1px solid var(--vg-line2)' }}>
                <Icon name="search" size={16} style={{ color: 'var(--vg-ink3)' }} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isFa ? 'جستجوی مدل، ابزار یا تعرفه…' : 'Search models, tools, pricing…'}
                  aria-label={isFa ? 'جستجوی مدل‌ها' : 'Search models'}
                  style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--vg-ink)', fontSize: 13.5 }}
                />
              </form>

              {isAdmin && (
                <div className="vg-sheet-sec">
                  <span className="lbl">{isFa ? 'پنل ادمین' : 'Admin Control Plane'}</span>
                  <div className="vg-sheet-grid">
                    <Link href="/admin/providers" className="vg-sheet-tile accent" onClick={close}>
                      <Icon name="key" size={17} />
                      <span>
                        <strong>{isFa ? 'پروایدرها و کلیدها' : 'Providers & Keys'}</strong>
                        <small>{isFa ? 'استخر چندکلیدی' : 'Multi-key pools'}</small>
                      </span>
                    </Link>
                    <Link href="/admin/models" className="vg-sheet-tile" onClick={close}>
                      <Icon name="cpu" size={17} />
                      <span>
                        <strong>{isFa ? 'مدل‌ها و روتینگ' : 'Models & Routing'}</strong>
                        <small>{isFa ? 'مسیرهای Upstream' : 'Endpoints & pricing'}</small>
                      </span>
                    </Link>
                    <Link href="/admin/users" className="vg-sheet-tile" onClick={close}>
                      <Icon name="users" size={17} />
                      <span>
                        <strong>{isFa ? 'کاربران و اعتبار' : 'Users & Credits'}</strong>
                        <small>{isFa ? 'کیف‌پول و کلیدها' : 'Balances & keys'}</small>
                      </span>
                    </Link>
                    <Link href="/admin" className="vg-sheet-tile" onClick={close}>
                      <Icon name="text" size={17} />
                      <span>
                        <strong>{isFa ? 'محتوا و ابزارها' : 'Content Desk'}</strong>
                        <small>{isFa ? 'اخبار، اینباکس، ابزار' : 'News, Inbox, Tools'}</small>
                      </span>
                    </Link>
                  </div>
                </div>
              )}

              <div className="vg-sheet-sec">
                <span className="lbl">{isFa ? 'بخش‌های اصلی' : 'Workspaces & Site'}</span>
                <div className="vg-sheet-grid">
                  <a href="/chat" className="vg-sheet-tile" onClick={close}>
                    <Icon name="chat" size={17} style={{ color: 'var(--vg-orange-text)' }} />
                    <span>
                      <strong>{isFa ? 'چت AI' : 'AI Chat'}</strong>
                      <small>{isFa ? 'با دکمه‌ی بازگشت' : 'With Back bar'}</small>
                    </span>
                  </a>
                  <Link href={signedIn ? '/dashboard#keys' : '/signin?next=/dashboard'} className="vg-sheet-tile" onClick={close}>
                    <Icon name="wallet" size={17} />
                    <span>
                      <strong>{isFa ? 'پنل API و کیف‌پول' : 'API Console'}</strong>
                      <small>{isFa ? 'کلیدها و شارژ' : 'Keys & AvexPay'}</small>
                    </span>
                  </Link>
                  <Link href="/models" className="vg-sheet-tile" onClick={close}>
                    <Icon name="cpu" size={17} />
                    <span>
                      <strong>{isFa ? 'مدل‌ها و تعرفه' : 'Models & Pricing'}</strong>
                      <small>{isFa ? '۵۸+ مدل پیشتاز' : '58+ frontier models'}</small>
                    </span>
                  </Link>
                  <Link href="/leaderboard" className="vg-sheet-tile" onClick={close}>
                    <Icon name="bars" size={17} />
                    <span>
                      <strong>{isFa ? 'بنچمارک و رتبه‌بندی' : 'Benchmarks'}</strong>
                      <small>{isFa ? 'رتبه‌بندی زنده' : 'Live benchmarks'}</small>
                    </span>
                  </Link>
                  <Link href={isFa ? '/news/fa' : '/news'} className="vg-sheet-tile" onClick={close}>
                    <Icon name="text" size={17} />
                    <span>
                      <strong>{isFa ? 'اخبار AI' : 'AI News'}</strong>
                      <small>{isFa ? 'تحریریه دوزبانه' : 'Bilingual desk'}</small>
                    </span>
                  </Link>
                  <Link href="/tools" className="vg-sheet-tile" onClick={close}>
                    <Icon name="grid" size={17} />
                    <span>
                      <strong>{isFa ? 'دایرکتوری ابزارها' : 'Tools Directory'}</strong>
                      <small>{isFa ? '۲۴ ابزار AI' : '24 curated apps'}</small>
                    </span>
                  </Link>
                </div>
              </div>

              <div className="vg-sheet-controls">
                <LanguageSwitch variant="mobile" lang={lang} altHref={altHref} onNavigate={close} />
                <ThemeToggle variant="drawer" lang={lang} />
              </div>

              <div className="vg-sheet-foot">
                <Link
                  href={signedIn ? '/dashboard' : '/signin'}
                  className="btn gh"
                  style={{ flex: '1 1 0', minHeight: 46, fontSize: 14 }}
                  onClick={close}
                >
                  {signedIn ? (isFa ? 'داشبورد' : 'Dashboard') : isFa ? 'ورود' : 'Sign in'}
                </Link>
                <Link
                  href={signedIn ? '/dashboard#credits' : '/signup?next=/dashboard'}
                  className="btn key"
                  style={{ flex: '1 1 0', minHeight: 46, fontSize: 14 }}
                  onClick={close}
                >
                  {signedIn ? (isFa ? 'خرید اعتبار' : 'Buy credits') : isFa ? 'دریافت کلید API' : 'Get API key'}
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
