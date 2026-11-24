import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { getCurrentAdminUser, isAdminUser, probeAdminDb, type AdminDbHealth } from '@/lib/admin';
import { getCurrentUser } from '@/lib/auth';
import { PREVIEW_MODE } from '@/lib/preview';
import { SiteFooter } from '../site-footer';
import { SiteHeader } from '../site-header';
import { Breadcrumb, Icon, type IconName } from '../ui';
import { AdminClientGate } from './admin-client-gate';
import { AdminDbBanner } from './admin-db-banner';

export type AdminSection = 'providers' | 'models' | 'users' | 'articles' | 'inbox' | 'tools';

const PRIMARY_TABS: ReadonlyArray<{
  id: 'providers' | 'models' | 'users' | 'content';
  label: string;
  shortLabel: string;
  href: string;
  icon: IconName;
}> = [
  { id: 'providers', label: 'Providers & Keys', shortLabel: 'Providers', href: '/admin/providers', icon: 'key' },
  { id: 'models', label: 'Models & Routing', shortLabel: 'Models', href: '/admin/models', icon: 'cube' },
  { id: 'users', label: 'Users & Credits', shortLabel: 'Users', href: '/admin/users', icon: 'users' },
  { id: 'content', label: 'Content', shortLabel: 'Content', href: '/admin', icon: 'text' },
];

const CONTENT_SUBTABS: ReadonlyArray<{ id: 'articles' | 'inbox' | 'tools'; label: string; href: string }> = [
  { id: 'articles', label: 'Articles', href: '/admin' },
  { id: 'inbox', label: 'News inbox', href: '/admin/inbox' },
  { id: 'tools', label: 'Tools', href: '/admin/tools' },
];

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
        <>
          <SiteHeader ticker={false} />
          <main id="main" className="wrap adm-main">
            <AdminSkeleton />
          </main>
          <SiteFooter />
        </>
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

/** Frame for every admin page: header, breadcrumb, title, live DB status, and 4-pillar nav. */
export function AdminShell({
  active,
  title,
  crumbs = [],
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

  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap adm-main">
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Admin', href: '/admin/providers' }, ...crumbs]} style={{ paddingTop: 22 }} />

        <div className="adm-head">
          <h1 className="sf adm-title">{title}</h1>
          {actions && <div className="adm-head-actions">{actions}</div>}
        </div>

        <nav aria-label="Admin sections" className="adm-nav">
          {PRIMARY_TABS.map((t) => {
            const on = t.id === primaryActive;
            return (
              <Link key={t.id} href={t.href} className={`adm-tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
                <Icon name={t.icon} size={16} />
                <span className="adm-tab-full">{t.label}</span>
                <span className="adm-tab-short">{t.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        {isContent && (
          <nav aria-label="Content sections" className="adm-subnav">
            {CONTENT_SUBTABS.map((t) => (
              <Link key={t.id} href={t.href} className={`chip${t.id === active ? ' on' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        )}

        {adminEmail && dbHealth && <AdminDbBanner email={adminEmail} authVia={authVia ?? 'postgres'} initialDb={dbHealth} />}

        {children}
      </main>
      <SiteFooter />
    </>
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
