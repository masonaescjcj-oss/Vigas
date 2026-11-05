import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { validateCallbackUrl } from '@vigas/core/server';
import { ConsentButtons } from '@/components/consent-buttons';
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
 * "Sign in with Vigas" consent page (PKCE). Apps such as RetroBuild send users here with
 * callback_url, code_challenge, code_challenge_method, app and an optional monthly limit in USD.
 * See docs/SIGN-IN-WITH-VIGAS.md.
 */
export default function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingTop: 56, paddingBottom: 96, display: 'flex', justifyContent: 'center' }}>
        <Suspense fallback={<div className="card" style={{ width: '100%', maxWidth: 560, height: 420, borderRadius: 24 }} aria-busy="true" />}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Consent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const callback = validateCallbackUrl(get('callback_url'));
  const challenge = get('code_challenge');
  const method = get('code_challenge_method') || 'S256';
  const app = get('app').trim().slice(0, 60) || 'An app';
  const limitRaw = get('limit');
  const limitUsd = limitRaw ? Number(limitRaw) : null;

  const problems: string[] = [];
  if (!callback) problems.push('The return address (callback_url) is missing or not secure. It must start with https://.');
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(challenge)) problems.push('The security code (code_challenge) is missing or malformed.');
  if (method !== 'S256' && method !== 'plain') problems.push('code_challenge_method must be S256.');
  if (limitUsd !== null && !(Number.isFinite(limitUsd) && limitUsd >= 1 && limitUsd <= 100_000)) problems.push('The monthly limit must be between $1 and $100,000.');

  if (problems.length) {
    return (
      <section className="card" style={{ width: '100%', maxWidth: 560, borderRadius: 24, padding: 'clamp(22px,4vw,36px)' }}>
        <div className="lbl" style={{ color: 'var(--vg-red)' }}>Authorization error</div>
        <h1 className="sf" style={{ fontSize: 40, lineHeight: 1.05, margin: '12px 0 14px' }}>This sign-in link can’t be used.</h1>
        <p style={{ color: 'var(--vg-ink2)', margin: '0 0 12px' }}>Go back to the app and try again. If it keeps happening, tell the app’s developer:</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--vg-ink2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
    redirect(`/signin?next=${encodeURIComponent(`/auth?${qs}`)}`);
  }

  const host = new URL(callback!).host;
  const rows: Array<[string, string]> = [
    ['Gets', 'An API key on your account (you can revoke it any time in your dashboard)'],
    ['Pays with', 'Your Vigas credits'],
    ['Monthly limit', limitUsd ? `$${limitUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'None — up to your balance'],
    ['Returns you to', host],
    ['Signed in as', user.email],
  ];

  return (
    <section className="card" style={{ width: '100%', maxWidth: 560, borderRadius: 24, padding: 'clamp(22px,4vw,36px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LogoMark size={28} />
        <Icon name="arrow" size={18} style={{ color: 'var(--vg-ink3)' }} />
        <span
          aria-hidden="true"
          className="sf"
          style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange)' }}
        >
          {app.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <div className="lbl" style={{ marginTop: 22 }}>Sign in with Vigas</div>
      <h1 className="sf" style={{ fontSize: 'clamp(34px,4vw,44px)', lineHeight: 1.05, letterSpacing: '-.02em', margin: '10px 0 18px' }}>
        Allow <em className="hi">{app}</em> to use your Vigas account?
      </h1>
      <dl style={{ margin: 0, borderTop: '1px solid var(--vg-line)' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--vg-line)', flexWrap: 'wrap' }}>
            <dt className="mn" style={{ flex: '0 0 130px', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.08em', paddingTop: 2 }}>{k}</dt>
            <dd style={{ margin: 0, flex: '1 1 240px', minWidth: 0, color: k === 'Returns you to' ? 'var(--vg-ink)' : 'var(--vg-ink2)', fontWeight: k === 'Returns you to' ? 600 : 400, overflowWrap: 'anywhere' }}>{v}</dd>
          </div>
        ))}
      </dl>
      <p style={{ fontSize: 13, color: 'var(--vg-ink3)', margin: '14px 0 20px' }}>
        Only approve apps you trust. Check that <b style={{ color: 'var(--vg-ink2)' }}>{host}</b> is the site you came from.
      </p>
      <ConsentButtons
        callbackUrl={callback!}
        codeChallenge={challenge}
        codeChallengeMethod={method as 'S256' | 'plain'}
        app={app}
        limitMicros={limitUsd ? Math.round(limitUsd * 1e6) : null}
      />
    </section>
  );
}
