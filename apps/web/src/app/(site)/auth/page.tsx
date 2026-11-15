import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { validateCallbackUrl } from '@vigas/core/server';
import { ConsentButtons } from '@/components/consent-buttons';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Icon, LogoMark } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Authorize an app',
  description: 'Let an app use your Vigas account and credits.',
  path: '/auth',
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * "Sign in with Vigas" consent page (PKCE). External apps and coding agents send users here with
 * callback_url, code_challenge, code_challenge_method, app and an optional monthly limit in USD.
 * See docs/SIGN-IN-WITH-VIGAS.md.
 */
export default function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ConsentSkeleton />}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}

function ConsentSkeleton() {
  return (
    <>
      <SiteHeader ticker={false} lang="en" />
      <main id="main" className="wrap" style={{ paddingTop: 56, paddingBottom: 96, display: 'flex', justifyContent: 'center' }}>
        <div className="card" style={{ width: '100%', maxWidth: 560, height: 420, borderRadius: 24 }} aria-busy="true" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}

async function Consent({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get('vg_lang')?.value === 'fa' ? 'fa' : 'en';
  const isFa = lang === 'fa';

  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const callback = validateCallbackUrl(get('callback_url'));
  const challenge = get('code_challenge');
  const method = get('code_challenge_method') || 'S256';
  const app = get('app').trim().slice(0, 60) || (isFa ? 'یک اپلیکیشن' : 'An app');
  const limitRaw = get('limit');
  const limitUsd = limitRaw ? Number(limitRaw) : null;

  const problems: string[] = [];
  if (!callback) {
    problems.push(
      isFa
        ? 'آدرس بازگشت (callback_url) نامعتبر است یا با https:// شروع نمی‌شود.'
        : 'The return address (callback_url) is missing or not secure. It must start with https://.',
    );
  }
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(challenge)) {
    problems.push(isFa ? 'کد امنیتی (code_challenge) ارسال نشده یا نامعتبر است.' : 'The security code (code_challenge) is missing or malformed.');
  }
  if (method !== 'S256' && method !== 'plain') {
    problems.push(isFa ? 'مقدار code_challenge_method باید S256 باشد.' : 'code_challenge_method must be S256.');
  }
  if (limitUsd !== null && !(Number.isFinite(limitUsd) && limitUsd >= 1 && limitUsd <= 100_000)) {
    problems.push(isFa ? 'سقف مصرف ماهانه باید بین ۱ تا ۱۰۰,۰۰۰ دلار باشد.' : 'The monthly limit must be between $1 and $100,000.');
  }

  const wrap = (inner: React.ReactNode) => {
    const body = (
      <>
        <SiteHeader ticker={false} lang={lang} />
        <main id="main" className="wrap" style={{ paddingTop: 56, paddingBottom: 96, display: 'flex', justifyContent: 'center' }}>
          {inner}
        </main>
        <SiteFooter lang={lang} />
      </>
    );
    if (isFa) {
      return (
        <div dir="rtl" lang="fa" className="fa-ui">
          {body}
        </div>
      );
    }
    return body;
  };

  if (problems.length) {
    return wrap(
      <section className="card" style={{ width: '100%', maxWidth: 560, borderRadius: 24, padding: 'clamp(22px,4vw,36px)' }}>
        <div className="lbl" style={{ color: 'var(--vg-red)' }}>
          {isFa ? 'خطای احراز مجوز' : 'Authorization error'}
        </div>
        <h1 className="sf" style={{ fontSize: isFa ? 32 : 40, lineHeight: isFa ? 1.2 : 1.05, fontWeight: isFa ? 700 : 400, margin: '12px 0 14px' }}>
          {isFa ? 'این لینک ورود قابل استفاده نیست.' : 'This sign-in link can’t be used.'}
        </h1>
        <p style={{ color: 'var(--vg-ink2)', margin: '0 0 12px' }}>
          {isFa
            ? 'به اپلیکیشن برگردید و دوباره تلاش کنید. اگر مشکل ادامه داشت، پیام زیر را به توسعه‌دهنده اپلیکیشن اطلاع دهید:'
            : 'Go back to the app and try again. If it keeps happening, tell the app’s developer:'}
        </p>
        <ul style={{ margin: 0, paddingInlineStart: 18, color: 'var(--vg-ink2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>,
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
    redirect(`/signin?next=${encodeURIComponent(`/auth?${qs}`)}`);
  }

  const host = new URL(callback!).host;
  const rows: Array<{ label: string; value: string; ltr?: boolean }> = isFa
    ? [
        { label: 'دسترسی', value: 'ساخت یک کلید API روی حساب شما (هر زمان در داشبورد قابل لغو است)' },
        { label: 'پرداخت از', value: 'اعتبار کیف‌پول ویگاس شما' },
        {
          label: 'سقف ماهانه',
          value: limitUsd ? `$${limitUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'نامحدود — تا سقف موجودی حساب',
          ltr: Boolean(limitUsd),
        },
        { label: 'بازگشت به', value: host, ltr: true },
        { label: 'حساب کاربری', value: user.email, ltr: true },
      ]
    : [
        { label: 'Gets', value: 'An API key on your account (you can revoke it any time in your dashboard)' },
        { label: 'Pays with', value: 'Your Vigas credits' },
        {
          label: 'Monthly limit',
          value: limitUsd ? `$${limitUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'None — up to your balance',
        },
        { label: 'Returns you to', value: host },
        { label: 'Signed in as', value: user.email },
      ];

  return wrap(
    <section className="card" style={{ width: '100%', maxWidth: 560, borderRadius: 24, padding: 'clamp(22px,4vw,36px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LogoMark size={28} />
        <Icon name="arrow" size={18} style={{ color: 'var(--vg-ink3)', transform: isFa ? 'scaleX(-1)' : undefined }} />
        <span
          aria-hidden="true"
          className="sf"
          style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)' }}
        >
          {app.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <div className="lbl" style={{ marginTop: 22 }}>
        {isFa ? 'ورود با ویگاس' : 'Sign in with Vigas'}
      </div>
      <h1
        className="sf"
        style={{
          fontSize: isFa ? 'clamp(28px,3.6vw,38px)' : 'clamp(34px,4vw,44px)',
          lineHeight: isFa ? 1.2 : 1.05,
          letterSpacing: isFa ? 0 : '-.02em',
          fontWeight: isFa ? 700 : 400,
          margin: '10px 0 18px',
        }}
      >
        {isFa ? (
          <>
            اجازه می‌دهید <em className="hi">{app}</em> به حساب ویگاس شما متصل شود؟
          </>
        ) : (
          <>
            Allow <em className="hi">{app}</em> to use your Vigas account?
          </>
        )}
      </h1>
      <dl style={{ margin: 0, borderTop: '1px solid var(--vg-line)' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--vg-line)', flexWrap: 'wrap' }}>
            <dt className="mn" style={{ flex: '0 0 130px', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: isFa ? 0 : '.08em', paddingTop: 2 }}>
              {r.label}
            </dt>
            <dd
              dir={r.ltr ? 'ltr' : undefined}
              style={{
                margin: 0,
                flex: '1 1 240px',
                minWidth: 0,
                color: r.label === 'Returns you to' || r.label === 'بازگشت به' ? 'var(--vg-ink)' : 'var(--vg-ink2)',
                fontWeight: r.label === 'Returns you to' || r.label === 'بازگشت به' ? 600 : 400,
                overflowWrap: 'anywhere',
                textAlign: isFa && r.ltr ? 'right' : undefined,
              }}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p style={{ fontSize: 13, color: 'var(--vg-ink3)', margin: '14px 0 20px' }}>
        {isFa ? (
          <>
            تنها به برنامه‌هایی که به آن‌ها اعتماد دارید دسترسی بدهید. مطمئن شوید آدرس <b dir="ltr" style={{ color: 'var(--vg-ink2)' }}>{host}</b> همان وب‌سایت مبدأ است.
          </>
        ) : (
          <>
            Only approve apps you trust. Check that <b style={{ color: 'var(--vg-ink2)' }}>{host}</b> is the site you came from.
          </>
        )}
      </p>
      <ConsentButtons
        callbackUrl={callback!}
        codeChallenge={challenge}
        codeChallengeMethod={method as 'S256' | 'plain'}
        app={app}
        limitMicros={limitUsd ? Math.round(limitUsd * 1e6) : null}
        lang={lang}
      />
    </section>,
  );
}
