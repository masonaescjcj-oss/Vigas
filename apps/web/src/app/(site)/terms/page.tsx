import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, JsonLd } from '@/components/ui';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'Terms governing use of the Vigas website, public leaderboards, tools directory, and OpenAI-compatible AI gateway.',
  path: '/terms',
});

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Using Vigas',
    body: 'Vigas provides public model benchmarks, editorial news reporting, a community tools directory, and an OpenAI-compatible API gateway backed by prepaid credits. By using Vigas, you agree to comply with applicable laws and upstream provider acceptable-use policies.',
  },
  {
    title: '2. Prepaid credits & pricing',
    body: 'API and chat requests deduct per-token charges based on the published pricing sheet on the Models page. Credits are denominated in USD. After your first $5 in lifetime top-ups, any displayed platform fee is shown transparently before payment.',
  },
  {
    title: '3. Public directory & leaderboard data',
    body: 'Community upvotes, leaderboard scores, and curated listings are provided for informational comparison. You may embed the public Vigas leaderboard widget on external websites provided attribution remains intact.',
  },
  {
    title: '4. Contact',
    body: 'Questions about these terms or tool listings can be sent to legal@vigas.ai.',
  },
];

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Terms of Service', path: '/terms' },
        ])}
      />
      <SiteHeader />
      <main id="main" className="wrap" style={{ maxWidth: 880, paddingBottom: 96 }}>
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Terms of Service' }]} style={{ paddingTop: 28 }} />
        <header style={{ padding: '24px 0 36px', borderBottom: '1px solid var(--vg-line)' }}>
          <div className="lbl">§ Legal · Effective 2026</div>
          <h1 className="sf" style={{ fontSize: 'clamp(40px,5.4vw,68px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '14px 0 12px' }}>
            Terms of <em className="hi">Service</em>
          </h1>
          <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 17, maxWidth: 620 }}>
            Clear rules covering prepaid gateway credits, directory submissions, and embedding public Vigas rankings.
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
          <Link href="/privacy" className="tag">
            Privacy Policy
          </Link>
          <Link href="/tools" className="tag">
            AI Tools directory
          </Link>
          <Link href="/leaderboard" className="tag">
            Leaderboard
          </Link>
        </nav>
      </main>
    </>
  );
}
