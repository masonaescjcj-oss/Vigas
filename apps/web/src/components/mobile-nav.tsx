'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSignedInHint } from '@/lib/client/session';
import { LanguageSwitch } from './language-switch';
import { ThemeToggle } from './theme-toggle';
import { Icon, LogoMark } from './ui';

export function MobileNav({
  active,
  nav,
  lang = 'en',
  altHref,
}: {
  active: string;
  nav: ReadonlyArray<readonly [string, string, string]>;
  lang?: 'en' | 'fa';
  altHref?: string;
}) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const signedIn = useSignedInHint();
  const isFa = lang === 'fa';

  const close = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  useEffect(() => {
    close();
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = detailsRef.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) {
        el.open = false;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false;
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const currentLabel = active === 'home' ? 'Vigas' : (nav.find(([id]) => id === active)?.[1] ?? 'Vigas');

  return (
    <details ref={detailsRef} className="hdr-menu">
      <summary className="hdr-menu-pill" aria-label={isFa ? 'باز کردن منو' : 'Toggle navigation menu'}>
        <LogoMark size={20} />
        <span className="sf" style={{ fontSize: 23, lineHeight: 1, letterSpacing: '-.01em' }}>
          Vigas
        </span>
        {active !== 'home' && active !== 'none' && <span className="mn hdr-menu-cur">{currentLabel}</span>}
        <Icon name="chevDown" size={14} className="hdr-menu-chev" />
      </summary>

      <nav aria-label={isFa ? 'منوی موبایل' : 'Mobile navigation'} className="hdr-menu-pop">
        <div className="hdr-menu-links">
          <Link href={isFa ? '/fa' : '/'} aria-current={active === 'home' ? 'page' : undefined} onClick={close}>
            <span>{isFa ? 'خانه' : 'Home'}</span>
            <span className="mn" style={{ fontSize: 11, opacity: 0.65 }}>
              {isFa ? 'نمای کلی' : 'Overview'}
            </span>
          </Link>
          {nav.map(([id, label, href]) => (
            <Link key={id} href={href} aria-current={id === active ? 'page' : undefined} onClick={close}>
              <span>{label}</span>
              {id === 'models' && <span className="mn hdr-menu-tag">{isFa ? 'کمترین نرخ' : 'Lowest rates'}</span>}
              {id === 'leaderboard' && <span className="mn hdr-menu-tag">Arena</span>}
              {id === 'tools' && <span className="mn hdr-menu-tag">{isFa ? '۲۴ ابزار' : '24 apps'}</span>}
            </Link>
          ))}
        </div>

        <LanguageSwitch variant="mobile" lang={lang} altHref={altHref} onNavigate={close} />
        <ThemeToggle variant="drawer" lang={lang} />

        <div className="hdr-menu-foot">
          <Link
            href={signedIn ? '/dashboard' : '/signin'}
            className="btn gh"
            style={{ flex: '1 1 0', minHeight: 38, fontSize: 13 }}
            onClick={close}
          >
            {signedIn ? (isFa ? 'داشبورد' : 'Dashboard') : isFa ? 'ورود' : 'Sign in'}
          </Link>
          <Link
            href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'}
            className="btn key"
            style={{ flex: '1 1 0', minHeight: 38, fontSize: 13 }}
            onClick={close}
          >
            {isFa ? 'دریافت کلید API' : 'Get API key'}
          </Link>
        </div>
      </nav>
    </details>
  );
}
