import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { getDb, getWallet } from '@vigas/db';
import { DashboardGate } from '@/components/dashboard/dashboard-gate';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb } from '@/components/ui';
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
  const wallet = user ? await getWallet(getDb(), user.accountId, env.topupFeeBps) : null;

  const content = (
    <>
      <SiteHeader ticker={false} lang={lang} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb lang={lang} items={[{ name: isFa ? 'خانه' : 'Home', href: isFa ? '/fa' : '/' }, { name: isFa ? 'پنل API' : 'API Console' }]} style={{ paddingTop: 28 }} />
        <h1
          className="sf"
          style={{
            fontSize: isFa ? 'clamp(32px,4.4vw,52px)' : 'clamp(40px,5vw,66px)',
            lineHeight: isFa ? 1.15 : 1,
            letterSpacing: isFa ? 0 : '-.03em',
            fontWeight: isFa ? 700 : 400,
            margin: '16px 0 22px',
          }}
        >
          {isFa ? (
            <>
              پنل <em className="hi">فروش و مدیریت API.</em>
            </>
          ) : (
            <>
              Vigas <em className="hi">API Console.</em>
            </>
          )}
        </h1>
        <DashboardGate
          initialUser={user ? toPublicUser(user) : null}
          initialWallet={wallet}
          models={models}
          paymentMode={activePaymentMode(env)}
          lang={lang}
        />
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
  return (
    <>
      <SiteHeader ticker={false} lang="en" />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'API Console' }]} style={{ paddingTop: 28 }} />
        <h1 className="sf" style={{ fontSize: 'clamp(40px,5vw,66px)', lineHeight: 1, letterSpacing: '-.03em', margin: '16px 0 22px' }}>
          Vigas <em className="hi">API Console.</em>
        </h1>
        <div aria-busy="true" aria-label="Loading your API Console">
          <p style={{ margin: '-8px 0 24px', color: 'var(--vg-ink3)' }}>Loading your account…</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 104, borderRadius: 18 }} />
            ))}
          </div>
          <div className="card" style={{ height: 340, borderRadius: 22 }} />
        </div>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
