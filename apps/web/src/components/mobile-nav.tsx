'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
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
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const open = openedAtPath === pathname;
  const drawerId = useId();
  const signedIn = useSignedInHint();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenedAtPath(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpenedAtPath(null);

  return (
    <>
      <button
        type="button"
        className="ib hdr-toggle"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label="Open navigation menu"
        onClick={() => setOpenedAtPath((prev) => (prev === pathname ? null : pathname))}
      >
        <Icon name={open ? 'x' : 'menu'} size={20} />
      </button>

      {open && (
        <button
          type="button"
          className="hdr-drawer-scrim"
          data-open="true"
          aria-label="Close navigation menu"
          onClick={close}
        />
      )}

      <aside
        id={drawerId}
        className="hdr-drawer"
        data-open={open}
        aria-hidden={!open}
        aria-label="Navigation menu"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--vg-line)' }}>
          <Link href="/" onClick={close} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--vg-ink)' }}>
            <LogoMark />
            <span className="sf" style={{ fontSize: 25, lineHeight: 1 }}>
              Vigas
            </span>
          </Link>
          <button type="button" className="ib" aria-label="Close navigation menu" onClick={close}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="hdr-drawer-nav">
          <Link href="/" aria-current={active === 'home' ? 'page' : undefined} onClick={close}>
            Home
          </Link>
          {nav.map(([id, label, href]) => (
            <Link key={id} href={href} aria-current={id === active ? 'page' : undefined} onClick={close}>
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: '1px solid var(--vg-line)' }}>
          <Link
            href={signedIn ? '/dashboard' : '/signin'}
            className="btn gh"
            style={{ width: '100%' }}
            onClick={close}
          >
            {signedIn ? 'Dashboard' : 'Sign in'}
          </Link>
          <Link
            href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'}
            className="btn key"
            style={{ width: '100%' }}
            onClick={close}
          >
            Get API key
          </Link>
        </div>
      </aside>
    </>
  );
}
