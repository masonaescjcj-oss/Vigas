'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { useAdminHint } from '@/lib/client/admin-fetch';
import { Icon, type IconName } from './ui';

interface DockItem {
  id: string;
  href: string;
  en: string;
  fa: string;
  icon: IconName;
  external?: boolean;
  dashboardHash?: 'keys' | 'credits';
  accent?: boolean;
  exit?: boolean;
}

const HIDDEN_PREFIXES = ['/embed', '/signin', '/signup', '/auth', '/fa-app/signin', '/fa-app/signup', '/chat'];

/**
 * Unified Context-Aware Floating Glass Bottom Dock (mobile `<= 860px`).
 * - Inside `/admin/*`: transforms into the Admin Control Plane dock (Providers, Models, Users, Content, Exit App)
 *   so there is NEVER a double top+bottom menu.
 * - Across the user app: shows the API-First 4+1 dock (Chat, Keys, Wallet, Models, Admin/Ranks).
 * - Hidden on `/chat` (which uses its own slim top Return Rail so the chat composer is never obstructed).
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

  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  const items: DockItem[] = inAdmin
    ? [
        { id: 'adm_providers', href: '/admin/providers', en: 'Providers', fa: 'پروایدرها', icon: 'key' },
        { id: 'adm_models', href: '/admin/models', en: 'Models', fa: 'مدل‌ها', icon: 'cube' },
        { id: 'adm_users', href: '/admin/users', en: 'Users', fa: 'کاربران', icon: 'users' },
        { id: 'adm_content', href: '/admin', en: 'Content', fa: 'محتوا', icon: 'text' },
        { id: 'adm_exit', href: '/dashboard', en: 'Exit App', fa: 'بازگشت', icon: 'logout', exit: true },
      ]
    : [
        { id: 'chat', href: '/chat', en: 'Chat', fa: 'چت', icon: 'chat', external: true },
        { id: 'keys', href: '/dashboard#keys', en: 'Keys', fa: 'کلید API', icon: 'key', dashboardHash: 'keys' },
        { id: 'wallet', href: '/dashboard#credits', en: 'Wallet', fa: 'کیف‌پول', icon: 'wallet', dashboardHash: 'credits' },
        { id: 'models', href: '/models', en: 'Models', fa: 'مدل‌ها', icon: 'cube' },
        isAdmin
          ? { id: 'admin', href: '/admin/providers', en: 'Admin', fa: 'ادمین', icon: 'shield', accent: true }
          : { id: 'ranks', href: '/leaderboard', en: 'Ranks', fa: 'رتبه‌بندی', icon: 'bars' },
      ];

  const isActive = (item: DockItem): boolean => {
    if (inAdmin) {
      if (item.id === 'adm_providers') return pathname.startsWith('/admin/providers');
      if (item.id === 'adm_models') return pathname.startsWith('/admin/models');
      if (item.id === 'adm_users') return pathname.startsWith('/admin/users');
      if (item.id === 'adm_content') {
        return (
          pathname === '/admin' ||
          pathname.startsWith('/admin/inbox') ||
          pathname.startsWith('/admin/tools') ||
          pathname.startsWith('/admin/articles')
        );
      }
      return false;
    }
    if (item.id === 'chat') return pathname.startsWith('/chat');
    if (item.id === 'keys') return pathname === '/dashboard' && (hash === 'keys' || hash === 'connect' || hash === 'overview' || hash === '');
    if (item.id === 'wallet') return pathname === '/dashboard' && hash === 'credits';
    if (item.id === 'models') return pathname === '/models' || pathname === '/fa-app/models' || (pathname === '/dashboard' && hash === 'models');
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
    <nav
      aria-label={inAdmin ? (isFa ? 'ناوبری پنل ادمین' : 'Admin navigation') : isFa ? 'ناوبری موبایل' : 'Mobile navigation'}
      className="vg-bnav"
    >
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
              className={`vg-bnav-item${active ? ' on' : ''}${item.accent ? ' accent' : ''}${item.exit ? ' exit' : ''}`}
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
