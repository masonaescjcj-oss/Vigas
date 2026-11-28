'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { useSignedInHint } from '@/lib/client/session';
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
 * - ONLY shown when the user is signed in (logged-out visitors should never see Wallet / API Keys tabs).
 * - Inside `/admin/*`: transforms into the Admin Control Plane dock (Providers, Models, Users, Content, Exit App).
 * - Hidden on `/chat` (which uses its own slim top Return Rail so the chat composer is never obstructed).
 */
export function MobileBottomNav() {
  const pathname = usePathname() || '/';
  const signedIn = useSignedInHint();
  const [hash, setHash] = useState('');
  const [isFa, setIsFa] = useState(false);

  const hiddenRoute = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const shouldRender = signedIn && !hiddenRoute;

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, '').toLowerCase());
    const syncLang = () => {
      const docFa =
        document.documentElement.lang === 'fa' ||
        document.documentElement.dir === 'rtl' ||
        document.cookie.includes('vg_lang=fa') ||
        Boolean(document.querySelector('[lang="fa"][dir="rtl"]'));
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

  useEffect(() => {
    document.body.classList.toggle('vg-has-dock', shouldRender);
    return () => {
      document.body.classList.remove('vg-has-dock');
    };
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  const items: DockItem[] = inAdmin
    ? [
        { id: 'adm_providers', href: '/admin/providers', en: 'Providers', fa: 'ارائه‌دهنده', icon: 'key' },
        { id: 'adm_models', href: '/admin/models', en: 'Models', fa: 'مدل‌ها', icon: 'cpu' },
        { id: 'adm_users', href: '/admin/users', en: 'Users', fa: 'کاربران', icon: 'users' },
        { id: 'adm_content', href: '/admin', en: 'Content', fa: 'محتوا', icon: 'text' },
        { id: 'adm_exit', href: '/dashboard', en: 'Exit', fa: 'خروج', icon: 'logout', exit: true },
      ]
    : [
        { id: 'chat', href: '/chat', en: 'Chat', fa: 'چت', icon: 'chat', external: true },
        { id: 'keys', href: '/dashboard#keys', en: 'API Keys', fa: 'کلید API', icon: 'key', dashboardHash: 'keys' },
        { id: 'wallet', href: '/dashboard#credits', en: 'Wallet', fa: 'کیف‌پول', icon: 'wallet', dashboardHash: 'credits' },
        { id: 'models', href: '/models', en: 'Models', fa: 'مدل‌ها', icon: 'cpu' },
        { id: 'explore', href: isFa ? '/fa' : '/', en: 'Explore', fa: 'کاوش', icon: 'compass' },
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
    if (item.id === 'explore') {
      return (
        pathname === '/' ||
        pathname === '/fa' ||
        pathname.startsWith('/leaderboard') ||
        pathname.startsWith('/fa-app/leaderboard') ||
        pathname.startsWith('/tools') ||
        pathname.startsWith('/fa-app/tools') ||
        pathname.startsWith('/news')
      );
    }
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
      dir={isFa ? 'rtl' : 'ltr'}
      className={`vg-bnav${isFa ? ' fa-ui' : ''}`}
    >
      <div className="vg-bnav-inner">
        {items.map((item) => {
          const active = isActive(item);
          const content = (
            <>
              <Icon name={item.icon} size={19} />
              {active && <span className="vg-bnav-lbl">{isFa ? item.fa : item.en}</span>}
            </>
          );

          if (item.external) {
            return (
              <a
                key={item.id}
                href={item.href}
                className={`vg-bnav-item${active ? ' on' : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-label={isFa ? item.fa : item.en}
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`vg-bnav-item${active ? ' on' : ''}${item.exit ? ' exit' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={isFa ? item.fa : item.en}
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
