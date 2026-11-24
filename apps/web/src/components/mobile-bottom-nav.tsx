'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { useAdminHint } from '@/lib/client/admin-fetch';
import { Icon, type IconName } from './ui';

interface NavItem {
  id: 'chat' | 'keys' | 'wallet' | 'models' | 'admin' | 'ranks';
  href: string;
  en: string;
  fa: string;
  icon: IconName;
  external?: boolean;
  dashboardHash?: 'keys' | 'credits';
  accent?: boolean;
}

const HIDDEN_PREFIXES = ['/embed', '/signin', '/signup', '/auth', '/fa-app/signin', '/fa-app/signup'];

/**
 * Fixed API-First 4+1 Mobile Bottom Navigation Bar (`<= 860px`).
 * Gives 1-tap thumb access to Chat, API & Keys, Wallet, Models, plus Admin (for admins) or Ranks.
 */
export function MobileBottomNav() {
  const pathname = usePathname() || '/';
  const isAdmin = useAdminHint();
  const [hash, setHash] = useState('');
  const [isFa, setIsFa] = useState(false);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, '').toLowerCase());
    const syncLang = () => {
      const docFa = document.documentElement.lang === 'fa' || document.documentElement.dir === 'rtl';
      const pathFa = pathname === '/fa' || pathname.startsWith('/news/fa') || pathname.startsWith('/fa-app');
      setIsFa(docFa || pathFa);
    };
    syncHash();
    syncLang();
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('vigas-hash', syncHash);
    return () => {
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('vigas-hash', syncHash);
    };
  }, [pathname]);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const items: NavItem[] = [
    { id: 'chat', href: '/chat', en: 'Chat', fa: 'چت', icon: 'chat', external: true },
    { id: 'keys', href: '/dashboard#keys', en: 'API & Keys', fa: 'کلید API', icon: 'key', dashboardHash: 'keys' },
    { id: 'wallet', href: '/dashboard#credits', en: 'Wallet', fa: 'کیف‌پول', icon: 'wallet', dashboardHash: 'credits' },
    { id: 'models', href: '/models', en: 'Models', fa: 'مدل‌ها', icon: 'cube' },
    isAdmin
      ? { id: 'admin', href: '/admin/providers', en: 'Admin', fa: 'ادمین', icon: 'shield', accent: true }
      : { id: 'ranks', href: '/leaderboard', en: 'Ranks', fa: 'رتبه‌بندی', icon: 'bars' },
  ];

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'chat') return pathname.startsWith('/chat');
    if (item.id === 'keys') return pathname === '/dashboard' && (hash === 'keys' || hash === 'connect' || hash === 'overview' || hash === '');
    if (item.id === 'wallet') return pathname === '/dashboard' && hash === 'credits';
    if (item.id === 'models') return pathname === '/models' || pathname === '/fa-app/models' || (pathname === '/dashboard' && hash === 'models');
    if (item.id === 'admin') return pathname === '/admin' || pathname.startsWith('/admin/');
    if (item.id === 'ranks') return pathname.startsWith('/leaderboard') || pathname.startsWith('/fa-app/leaderboard');
    return false;
  };

  const handleDashboardHash = (e: MouseEvent<HTMLAnchorElement>, targetHash: 'keys' | 'credits') => {
    if (pathname === '/dashboard') {
      e.preventDefault();
      window.history.replaceState(null, '', `/dashboard#${targetHash}`);
      window.dispatchEvent(new Event('vigas-hash'));
      setHash(targetHash);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav aria-label={isFa ? 'ناوبری سریع موبایل' : 'Mobile bottom navigation'} className="vg-bnav">
      <div className="vg-bnav-inner">
        {items.map((item) => {
          const active = isActive(item);
          const content = (
            <>
              <span className="vg-bnav-ico">
                <Icon name={item.icon} size={19} />
                {item.accent && <span className="vg-bnav-dot" aria-hidden="true" />}
              </span>
              <span className="vg-bnav-lbl">{isFa ? item.fa : item.en}</span>
            </>
          );

          if (item.external) {
            return (
              <a key={item.id} href={item.href} className={`vg-bnav-item${active ? ' on' : ''}`} aria-current={active ? 'page' : undefined}>
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`vg-bnav-item${active ? ' on' : ''}${item.accent ? ' accent' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={item.dashboardHash ? (e) => handleDashboardHash(e, item.dashboardHash!) : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
