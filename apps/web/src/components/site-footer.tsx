import Link from 'next/link';
import { Icon, LogoMark } from './ui';

const COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Models',
    links: [
      ['Anthropic models', '/models?org=Anthropic'],
      ['OpenAI models', '/models?org=OpenAI'],
      ['Google models', '/models?org=Google'],
      ['Open-weight models', '/models?org=NVIDIA'],
      ['Free models', '/models?tag=free'],
      ['Pricing', '/models'],
    ],
  },
  {
    title: 'Leaderboards',
    links: [
      ['Best overall agents', '/leaderboard'],
      ['Best coding agents', '/leaderboard/coding'],
      ['Best WebDev models', '/leaderboard/webdev'],
      ['Best text models', '/leaderboard/text'],
      ['Best image edit', '/leaderboard/image-edit'],
      ['Methodology', '/leaderboard#method'],
    ],
  },
  {
    title: 'News',
    links: ['Models', 'Agents', 'Analysis', 'Policy', 'Hardware', 'Funding'].map((c) => [c, `/news?category=${c}`] as [string, string]),
  },
  {
    title: 'Tools',
    links: [
      ['AI coding tools', '/tools?category=Coding'],
      ['AI image generators', '/tools?category=Image'],
      ['AI video tools', '/tools?category=Video'],
      ['AI voice & audio', '/tools?category=Audio'],
      ['Research assistants', '/tools?category=Research'],
      ['Submit a tool', '/tools#submit'],
    ],
  },
  {
    title: 'Developers',
    links: [
      ['API docs', '/models#quickstart'],
      ['Model prices', '/models'],
      ['Vigas Chat', '/chat'],
      ['RetroBuild', '/retrobuild'],
      ['Dashboard', '/dashboard'],
      ['Create an account', '/signup'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap" style={{ paddingTop: 64, paddingBottom: 28 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '36px 28px' }}>
          <div style={{ flex: '2 1 300px', minWidth: 0 }}>
            <Link href="/" aria-label="Vigas home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <LogoMark />
              <span className="sf" style={{ fontSize: 27, lineHeight: 1 }}>
                Vigas
              </span>
            </Link>
            <p style={{ color: 'var(--vg-ink2)', maxWidth: 320, margin: '16px 0 18px', fontSize: 14, lineHeight: 1.6 }}>
              The neutral ground for building with AI — one key, honest prices, and the news that matters.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="mn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  background: 'var(--vg-surface)',
                  boxShadow: 'inset 0 0 0 1px var(--vg-line)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--vg-green)',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vg-green)', display: 'inline-block' }} />
                OpenAI-compatible API
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  background: 'var(--vg-surface)',
                  boxShadow: 'inset 0 0 0 1px var(--vg-line2)',
                  fontSize: 12,
                  color: 'var(--vg-ink)',
                }}
              >
                <Icon name="phone" size={14} />
                Android app · coming soon
              </span>
            </div>
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title} style={{ flex: '1 1 150px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <span className="lbl" style={{ marginBottom: 4 }}>
                {col.title}
              </span>
              {col.links.map(([label, href]) => (
                <Link key={label} href={href} prefetch={false}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div
          aria-hidden="true"
          className="sf"
          style={{
            fontSize: 'clamp(120px,24vw,340px)',
            lineHeight: 0.8,
            letterSpacing: '-.05em',
            color: 'transparent',
            WebkitTextStroke: '1px rgba(239,234,225,.14)',
            textAlign: 'center',
            margin: '56px 0 36px',
            userSelect: 'none',
          }}
        >
          Vigas
        </div>
        <div
          className="mn"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--vg-ink3)',
            borderTop: '1px solid var(--vg-line)',
            paddingTop: 18,
          }}
        >
          <span>© 2026 Vigas Labs · Made with sand &amp; signal</span>
          <span style={{ display: 'flex', gap: 14 }}>
            <span style={{ color: 'var(--vg-ink)' }}>English</span>
            <span title="Persian edition coming soon">
              <span lang="fa" dir="rtl">
                فارسی
              </span>{' '}
              · soon
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
