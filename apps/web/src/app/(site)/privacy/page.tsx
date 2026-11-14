import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, JsonLd } from '@/components/ui';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'How Vigas handles account details, API gateway logs, anonymized leaderboard statistics, and privacy choices.',
  path: '/privacy',
});

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. What we collect',
    body: 'When you create an account, sign in with GitHub or Google, or purchase prepaid credits, we store only the account details required to authenticate your session, meter your token spend, and display your credit balance.',
  },
  {
    title: '2. Gateway prompts & Arena votes',
    body: 'API requests routed through Vigas are forwarded to your selected upstream model provider solely to fulfill your completion request. Public leaderboard win shares and blind pairwise Arena statistics are published strictly as aggregated, non-identifying rankings.',
  },
  {
    title: '3. Cookies & local storage',
    body: 'Vigas uses strictly necessary session cookies for authentication and minimal local storage state (such as mobile preview navigation state and composer drafts). We do not run third-party advertising trackers.',
  },
  {
    title: '4. Your choices & contact',
    body: 'You may revoke API keys, inspect transaction ledgers in your dashboard, or request deletion of your account data at any time by writing to privacy@vigas.ai.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' },
        ])}
      />
      <SiteHeader />
      <main id="main" className="wrap" style={{ maxWidth: 880, paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Privacy Policy' }]} style={{ paddingTop: 28 }} />
        <header style={{ padding: '24px 0 36px', borderBottom: '1px solid var(--vg-line)' }}>
          <div className="lbl">§ Legal · Effective 2026</div>
          <h1 className="sf" style={{ fontSize: 'clamp(40px,5.4vw,68px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '14px 0 12px' }}>
            Privacy <em className="hi">Policy</em>
          </h1>
          <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 17, maxWidth: 620 }}>
            Plain language on what data Vigas collects, how requests move through the model router, and how leaderboard statistics are aggregated.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 36 }}>
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="sf" style={{ fontSize: 28, fontWeight: 400, margin: '0 0 8px' }}>
                {s.title}
              </h2>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 16, lineHeight: 1.65 }}>{s.body}</p>
            </section>
          ))}
        </div>

        <nav aria-label="Related pages" style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--vg-line)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/terms" className="tag">
            Terms of Service
          </Link>
          <Link href="/leaderboard#method" className="tag">
            Leaderboard methodology
          </Link>
          <Link href="/models" className="tag">
            Models &amp; Pricing
          </Link>
        </nav>
      </main>
    </>
  );
}
