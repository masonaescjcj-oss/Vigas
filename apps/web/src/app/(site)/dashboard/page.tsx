import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getDb, getWallet } from '@vigas/db';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb } from '@/components/ui';
import { activePaymentMode } from '@/lib/avexpay';
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
    <Suspense fallback={<DashboardShellSkeleton />}>
      <DashboardInner />
    </Suspense>
  );
}

/** Reads the session and preferred language at request time inside Suspense; user data is never cached. */
async function DashboardInner() {
  const cookieStore = await cookies();
  const lang = cookieStore.get('vg_lang')?.value === 'fa' ? 'fa' : 'en';
  const isFa = lang === 'fa';

  const user = await getCurrentUser();
  if (!user) redirect('/signin?next=/dashboard');
  const env = serverEnv();
  const wallet = await getWallet(getDb(), user.accountId, env.topupFeeBps);
  if (!wallet) redirect('/signin?next=/dashboard');

  const content = (
    <>
      <SiteHeader ticker={false} lang={lang} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb lang={lang} items={[{ name: isFa ? 'خانه' : 'Home', href: isFa ? '/fa' : '/' }, { name: isFa ? 'داشبورد' : 'Dashboard' }]} style={{ paddingTop: 28 }} />
        <h1
          className="sf"
          style={{
            fontSize: isFa ? 'clamp(34px,4.8vw,56px)' : 'clamp(44px,5.4vw,72px)',
            lineHeight: isFa ? 1.15 : 1,
            letterSpacing: isFa ? 0 : '-.03em',
            fontWeight: isFa ? 700 : 400,
            margin: '18px 0 20px',
          }}
        >
          {isFa ? (
            <>
              داشبورد <em className="hi">کاربری شما.</em>
            </>
          ) : (
            <>
              Your <em className="hi">dashboard.</em>
            </>
          )}
        </h1>
        <DashboardClient user={toPublicUser(user)} initial={wallet} paymentMode={activePaymentMode(env)} lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );

  if (isFa) {
    return (
      <div dir="rtl" lang="fa" className="fa-ui">
        {content}
      </div>
    );
  }
  return content;
}

function DashboardShellSkeleton() {
  const block = (h: number, flex: string) => <div className="card" style={{ flex, minWidth: 0, height: h, borderRadius: 22 }} />;
  return (
    <>
      <SiteHeader ticker={false} lang="en" />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Dashboard' }]} style={{ paddingTop: 28 }} />
        <h1 className="sf" style={{ fontSize: 'clamp(44px,5.4vw,72px)', lineHeight: 1, letterSpacing: '-.03em', margin: '18px 0 20px' }}>
          Your <em className="hi">dashboard.</em>
        </h1>
        <div aria-busy="true" aria-label="Loading your dashboard">
          <p style={{ margin: '-8px 0 28px', color: 'var(--vg-ink3)' }}>Loading your account…</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {block(420, '1 1 380px')}
            {block(420, '1.4 1 460px')}
          </div>
          <div style={{ marginTop: 16 }}>{block(260, '1 1 100%')}</div>
        </div>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
