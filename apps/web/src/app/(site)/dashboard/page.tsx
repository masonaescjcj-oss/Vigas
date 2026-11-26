import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { getDb, getWallet } from '@vigas/db';
import { DashboardGate } from '@/components/dashboard/dashboard-gate';
import { activePaymentMode } from '@/lib/avexpay';
import { getCurrentUser, toPublicUser } from '@/lib/auth';
import { getModels } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'API Console & Dashboard',
  description: 'Manage your Vigas API keys, buy prepaid credits with AvexPay, explore 25+ AI models, and connect Cursor, Cline, Python, or Node.',
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

/**
 * Reads the Postgres session (when DATABASE_URL is set) and preferred language at request time.
 * When running on Supabase Auth without Postgres (or right after OAuth/chat login), DashboardGate
 * resolves the live Supabase session seamlessly on the client without trapping users in a redirect loop.
 */
async function DashboardInner() {
  const cookieStore = await cookies();
  const lang = cookieStore.get('vg_lang')?.value === 'fa' ? 'fa' : 'en';
  const isFa = lang === 'fa';

  const env = serverEnv();
  const [user, models] = await Promise.all([getCurrentUser(), getModels()]);
  const wallet = user ? await getWallet(getDb(), user.accountId, env.topupFeeBps).catch(() => null) : null;

  const content = (
    <main id="main" className="dash-main">
      <DashboardGate
        initialUser={user ? toPublicUser(user) : null}
        initialWallet={wallet}
        models={models}
        paymentMode={activePaymentMode(env)}
        lang={lang}
      />
    </main>
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
  return (
    <main id="main" className="dash-shell">
      <aside className="dash-rail dash-desk-only" aria-hidden="true" />
      <div className="dash-workspace">
        <div className="dash-body" aria-busy="true" aria-label="Loading your API Console">
          <p style={{ margin: '0 0 12px', color: 'var(--vg-ink3)', fontSize: 14 }}>Loading your workspace…</p>
          <div className="card" style={{ height: 220, borderRadius: 24 }} />
          <div className="card" style={{ height: 180, borderRadius: 24 }} />
        </div>
      </div>
    </main>
  );
}
