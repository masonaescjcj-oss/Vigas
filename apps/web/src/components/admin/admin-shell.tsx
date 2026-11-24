import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { isAdminUser } from '@/lib/admin';
import { getCurrentUser } from '@/lib/auth';
import { PREVIEW_MODE } from '@/lib/preview';
import { SiteFooter } from '../site-footer';
import { SiteHeader } from '../site-header';
import { Breadcrumb } from '../ui';
import { AdminClientGate } from './admin-client-gate';

const TABS = [
  { id: 'providers', label: 'Providers & Keys', href: '/admin/providers' },
  { id: 'models', label: 'Models & Routing', href: '/admin/models' },
  { id: 'users', label: 'Users & Credits', href: '/admin/users' },
  { id: 'articles', label: 'Articles', href: '/admin' },
  { id: 'inbox', label: 'News inbox', href: '/admin/inbox' },
  { id: 'tools', label: 'Tools', href: '/admin/tools' },
] as const;

type ShellProps = Parameters<typeof AdminShell>[0];

/**
 * Entry point for admin pages: verifies server session first, and when no Postgres cookie is
 * present yet (e.g. Google/Supabase SSO or PREVIEW_MODE) delegates to `AdminClientGate` to bridge
 * the Supabase JWT instead of showing a misleading 404.
 */
export function AdminPage(props: ShellProps) {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader ticker={false} />
          <main id="main" className="wrap" style={{ paddingTop: 28, paddingBottom: 96 }}>
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
  const user = await getCurrentUser();
  if (user) {
    if (!isAdminUser(user)) notFound();
    return <AdminShell {...props} />;
  }
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingTop: 28, paddingBottom: 96 }}>
        <AdminClientGate previewMode={PREVIEW_MODE} />
      </main>
      <SiteFooter />
    </>
  );
}

/** Frame for every admin page: header, breadcrumb, title and section tabs. */
export function AdminShell({
  active,
  title,
  crumbs = [],
  actions,
  children,
}: {
  active: (typeof TABS)[number]['id'];
  title: ReactNode;
  crumbs?: Array<{ name: string; href?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Admin', href: '/admin' }, ...crumbs]} style={{ paddingTop: 28 }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '16px 0 18px' }}>
          <h1 className="sf" style={{ fontSize: 'clamp(38px,4.6vw,60px)', lineHeight: 1, letterSpacing: '-.03em', margin: 0 }}>
            {title}
          </h1>
          {actions}
        </div>
        <nav aria-label="Admin sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {TABS.map((t) => (
            <Link key={t.id} href={t.href} className={`chip${t.id === active ? ' on' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
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
  return <div className="card" aria-busy="true" style={{ height: 360, borderRadius: 20 }} />;
}
