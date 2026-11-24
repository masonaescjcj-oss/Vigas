import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { getCurrentAdminUser, isAdminUser, probeAdminDb, type AdminDbHealth } from '@/lib/admin';
import { getCurrentUser } from '@/lib/auth';
import { PREVIEW_MODE } from '@/lib/preview';
import { MobileNav } from '../mobile-nav';
import { SiteFooter } from '../site-footer';
import { SiteHeader } from '../site-header';
import { ThemeToggle } from '../theme-toggle';
import { Icon, LogoMark, type IconName } from '../ui';
import { AdminClientGate } from './admin-client-gate';
import { AdminDbBanner } from './admin-db-banner';

export type AdminSection = 'providers' | 'models' | 'users' | 'articles' | 'inbox' | 'tools';

const RAIL_CONTROL: ReadonlyArray<{
  id: 'providers' | 'models' | 'users' | 'content';
  label: string;
  href: string;
  icon: IconName;
}> = [
  { id: 'providers', label: 'Providers & Keys', href: '/admin/providers', icon: 'key' },
  { id: 'models', label: 'Models & Routing', href: '/admin/models', icon: 'cube' },
  { id: 'users', label: 'Users & Credits', href: '/admin/users', icon: 'users' },
  { id: 'content', label: 'Content Desk', href: '/admin', icon: 'text' },
];

const CONTENT_SUBTABS: ReadonlyArray<{ id: 'articles' | 'inbox' | 'tools'; label: string; href: string }> = [
  { id: 'articles', label: 'Articles', href: '/admin' },
  { id: 'inbox', label: 'News inbox', href: '/admin/inbox' },
  { id: 'tools', label: 'Tools', href: '/admin/tools' },
];

const SECTION_PATH: Record<AdminSection, string> = {
  providers: 'vigas.app/admin/providers',
  models: 'vigas.app/admin/models',
  users: 'vigas.app/admin/users',
  articles: 'vigas.app/admin',
  inbox: 'vigas.app/admin/inbox',
  tools: 'vigas.app/admin/tools',
};

type ShellProps = Omit<Parameters<typeof AdminShell>[0], 'adminEmail' | 'authVia' | 'dbHealth'>;

/**
 * Entry point for admin pages: verifies either a first-party Postgres admin session OR the signed
 * httpOnly `vigas_admin_bridge` cookie (zero DB dependency). Only when neither cookie is present
 * yet does it delegate to `AdminClientGate` to bridge the Supabase JWT cleanly without reload loops.
 */
export function AdminPage(props: ShellProps) {
  return (
    <Suspense
      fallback={
        <div className="adm-layout">
          <div className="adm-body-col">
            <main id="main" className="adm-content">
              <AdminSkeleton />
            </main>
          </div>
        </div>
      }
    >
      <AdminGate {...props} />
    </Suspense>
  );
}

async function AdminGate(props: ShellProps) {
  const admin = await getCurrentAdminUser();
  if (admin) {
    const dbHealth = await probeAdminDb();
    return <AdminShell {...props} adminEmail={admin.user.email} authVia={admin.via} dbHealth={dbHealth} />;
  }
  const regularUser = await getCurrentUser();
  if (regularUser && !isAdminUser(regularUser)) {
    notFound();
  }
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap adm-main">
        <AdminClientGate previewMode={PREVIEW_MODE} />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Dedicated Admin Control Plane frame (v2 single-dock architecture):
 * - Desktop (`> 860px`): dedicated 246px sidebar rail + clean single-row topbar.
 * - Mobile (`<= 860px`): single sticky topbar (menu sheet + 1 page title + 1 action) and
 *   ONE bottom dock (rendered by `MobileBottomNav` in Admin mode — zero duplicate top+bottom menus).
 */
export function AdminShell({
  active,
  title,
  actions,
  adminEmail,
  authVia,
  dbHealth,
  children,
}: {
  active: AdminSection;
  title: ReactNode;
  crumbs?: Array<{ name: string; href?: string }>;
  actions?: ReactNode;
  adminEmail?: string;
  authVia?: 'postgres' | 'supabase_bridge';
  dbHealth?: AdminDbHealth;
  children: ReactNode;
}) {
  const isContent = active === 'articles' || active === 'inbox' || active === 'tools';
  const primaryActive = isContent ? 'content' : active;
  const initials = (adminEmail ?? 'AD').slice(0, 2).toUpperCase();

  return (
    <div className="adm-layout">
      {/* Desktop Sidebar Rail */}
      <aside className="adm-rail" aria-label="Admin navigation">
        <div className="adm-rail-brand">
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <LogoMark size={22} />
            <span className="sf" style={{ fontSize: 24, lineHeight: 1 }}>
              Vigas
            </span>
          </Link>
          <span className="adm-pill orange">ADMIN</span>
        </div>

        <div className="adm-rail-group">
          <div className="adm-rail-lbl">Control Plane</div>
          <nav className="adm-rail-list" aria-label="Admin sections">
            {RAIL_CONTROL.map((t) => {
              const on = t.id === primaryActive;
              return (
                <Link key={t.id} href={t.href} className={`adm-rail-link${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <Icon name={t.icon} size={16} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="adm-rail-group">
          <div className="adm-rail-lbl">Workspaces</div>
          <nav className="adm-rail-list" aria-label="Vigas workspaces">
            <Link href="/dashboard" className="adm-rail-link">
              <Icon name="wallet" size={16} />
              <span>API Console &amp; Wallet</span>
            </Link>
            <a href="/chat" className="adm-rail-link">
              <Icon name="chat" size={16} />
              <span>AI Chat (/chat)</span>
              <span className="adm-pill ok" style={{ marginLeft: 'auto', fontSize: 10 }}>
                Back ✓
              </span>
            </a>
            <Link href="/models" className="adm-rail-link">
              <Icon name="globe" size={16} />
              <span>Public Site</span>
            </Link>
          </nav>
        </div>

        <div className="adm-rail-foot">
          {adminEmail && (
            <div className="adm-rail-user">
              <span className="adm-avatar" aria-hidden="true">
                {initials}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {adminEmail}
                </div>
                <div className="mn" style={{ fontSize: 10.5, color: 'var(--vg-green)' }}>
                  {authVia === 'supabase_bridge' ? 'Supabase SSO · Admin' : 'Postgres · Admin'}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="adm-body-col">
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <div className="adm-topbar-menu">
              <Suspense fallback={null}>
                <MobileNav active={active} compact />
              </Suspense>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="sf adm-topbar-title">{title}</h1>
              <div className="mn adm-topbar-sub">{SECTION_PATH[active]}</div>
            </div>
          </div>

          <div className="adm-topbar-right">
            {actions && <div className="adm-topbar-actions">{actions}</div>}
            <ThemeToggle variant="icon" />
          </div>
        </header>

        <main id="main" className="adm-content">
          {isContent && (
            <nav aria-label="Content sections" className="adm-seg">
              {CONTENT_SUBTABS.map((t) => (
                <Link
                  key={t.id}
                  href={t.href}
                  className={`adm-seg-btn${t.id === active ? ' on' : ''}`}
                  aria-current={t.id === active ? 'page' : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          )}

          {adminEmail && dbHealth && <AdminDbBanner email={adminEmail} authVia={authVia ?? 'postgres'} initialDb={dbHealth} />}

          {children}
        </main>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'published' || status === 'drafted'
      ? 'var(--vg-green)'
      : status === 'error'
        ? 'var(--vg-red)'
        : status === 'draft' || status === 'new'
          ? 'var(--vg-sand)'
          : 'var(--vg-ink3)';
  return (
    <span className="mn" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--vg-raised)', color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

export function AdminSkeleton() {
  return <div className="card" aria-busy="true" style={{ height: 320, borderRadius: 20 }} />;
}
