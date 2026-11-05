import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Icon } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist on Vigas.',
  robots: { index: false, follow: true },
};

const LINKS: Array<[string, string, string]> = [
  ['/leaderboard', 'Leaderboard', 'Which AI models are winning this week'],
  ['/news', 'AI News', 'The stories that move the models'],
  ['/models', 'Models & prices', 'Every model behind one key'],
  ['/tools', 'Tools', 'What builders are upvoting'],
];

export default function NotFound() {
  return (
    <>
      <SiteHeader ticker={false} />
      <main id="main" className="wrap" style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <div className="lbl">§ Error 404</div>
            <h1 className="sf" style={{ fontSize: 'clamp(52px,7vw,100px)', lineHeight: 0.94, letterSpacing: '-.032em', margin: '18px 0' }}>
              Lost in the <em className="hi">colonnade.</em>
            </h1>
            <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 520, margin: 0 }}>
              The page you were looking for has moved, or never existed. Here are a few doors that do open.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              <Link href="/" className="btn key" style={{ minHeight: 50, padding: '0 24px' }}>
                Back to the home page
                <Icon name="arrow" size={16} />
              </Link>
              <Link href="/chat" className="btn gh" style={{ minHeight: 50, padding: '0 24px' }}>
                Ask Vigas Chat
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="sf" style={{ flex: '0 1 auto', fontSize: 'clamp(120px,18vw,240px)', lineHeight: 0.8, letterSpacing: '-.05em', color: 'transparent', WebkitTextStroke: '1px rgba(239,234,225,.24)' }}>
            404
          </div>
        </div>
        <nav aria-label="Popular pages" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 14, marginTop: 56 }}>
          {LINKS.map(([href, t, d]) => (
            <Link key={href} href={href} className="lift card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--vg-ink)' }}>
              <span className="sf" style={{ fontSize: 26 }}>
                {t}
              </span>
              <span style={{ fontSize: 14, color: 'var(--vg-ink2)' }}>{d}</span>
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
