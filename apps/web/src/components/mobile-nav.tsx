'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSignedInHint } from '@/lib/client/session';
import { Icon, LogoMark } from './ui';

export function MobileNav({
  active,
  nav,
}: {
  active: string;
  nav: ReadonlyArray<readonly [string, string, string]>;
}) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const signedIn = useSignedInHint();

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
      <summary className="hdr-menu-pill" aria-label="Toggle navigation menu">
        <LogoMark size={20} />
        <span className="sf" style={{ fontSize: 23, lineHeight: 1, letterSpacing: '-.01em' }}>
          Vigas
        </span>
        {active !== 'home' && active !== 'none' && (
          <span className="mn hdr-menu-cur">{currentLabel}</span>
        )}
        <Icon name="chevDown" size={14} className="hdr-menu-chev" />
      </summary>

      <nav aria-label="Mobile navigation" className="hdr-menu-pop">
        <div className="hdr-menu-links">
          <Link href="/" aria-current={active === 'home' ? 'page' : undefined} onClick={close}>
            <span>Home</span>
            <span className="mn" style={{ fontSize: 11, opacity: 0.65 }}>Overview</span>
          </Link>
          {nav.map(([id, label, href]) => (
            <Link key={id} href={href} aria-current={id === active ? 'page' : undefined} onClick={close}>
              <span>{label}</span>
              {id === 'leaderboard' && <span className="mn hdr-menu-tag">Arena</span>}
              {id === 'tools' && <span className="mn hdr-menu-tag">24 apps</span>}
            </Link>
          ))}
        </div>

        <div className="hdr-menu-foot">
          <Link
            href={signedIn ? '/dashboard' : '/signin'}
            className="btn gh"
            style={{ flex: '1 1 0', minHeight: 38, fontSize: 13 }}
            onClick={close}
          >
            {signedIn ? 'Dashboard' : 'Sign in'}
          </Link>
          <Link
            href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'}
            className="btn key"
            style={{ flex: '1 1 0', minHeight: 38, fontSize: 13 }}
            onClick={close}
          >
            Get API key
          </Link>
        </div>
      </nav>
    </details>
  );
}

