import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getDb, getWallet } from '@vigas/db';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb } from '@/components/ui';
import { getCurrentUser, toPublicUser } from '@/lib/auth';
import { serverEnv } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Dashboard',
  description: 'Your Vigas credits, usage and API keys.',
  path: '/dashboard',
  noindex: true,
});

export default function DashboardPage() {
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Dashboard' }]} style={{ paddingTop: 28 }} />
        <h1 className="sf" style={{ fontSize: 'clamp(44px,5.4vw,72px)', lineHeight: 1, letterSpacing: '-.03em', margin: '18px 0 20px' }}>
          Your <em className="hi">dashboard.</em>
        </h1>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData />
        </Suspense>
      </main>
    </>
  );
}

/** Reads the session at request time; user data is never cached. */
async function DashboardData() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/dashboard');
  const env = serverEnv();
  const wallet = await getWallet(getDb(), user.accountId, env.topupFeeBps);
  if (!wallet) redirect('/signin?next=/dashboard');
  return <DashboardClient user={toPublicUser(user)} initial={wallet} paymentsEnabled={env.paymentProvider === 'test'} />;
}

function DashboardSkeleton() {
  const block = (h: number, flex: string) => <div className="card" style={{ flex, minWidth: 0, height: h, borderRadius: 22 }} />;
  return (
    <div aria-busy="true" aria-label="Loading your dashboard">
      <p style={{ margin: '-8px 0 28px', color: 'var(--vg-ink3)' }}>Loading your account…</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {block(420, '1 1 380px')}
        {block(420, '1.4 1 460px')}
      </div>
      <div style={{ marginTop: 16 }}>{block(260, '1 1 100%')}</div>
    </div>
  );
}
