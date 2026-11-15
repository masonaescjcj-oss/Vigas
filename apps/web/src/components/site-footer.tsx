import Link from 'next/link';
import { Icon, LogoMark } from './ui';

const COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Models & API',
    links: [
      ['All models & pricing', '/models'],
      ['API quickstart', '/models#quickstart'],
      ['Free AI models', '/models?tag=free'],
      ['Vigas API apps', '/tools/collection/vigas-api'],
      ['New AI tools', '/tools/collection/new'],
      ['Create API account', '/signup'],
    ],
  },
  {
    title: 'Leaderboards',
    links: [
      ['Best overall agents', '/leaderboard'],
      ['Best coding agents', '/leaderboard/coding'],
      ['Best WebDev models', '/leaderboard/webdev'],
      ['Best text models', '/leaderboard/text'],
      ['Best vision models', '/leaderboard/vision'],
      ['Best image edit', '/leaderboard/image-edit'],
      ['Aligned & safe AI', '/leaderboard/aligned'],
      ['Knowledge work AI', '/leaderboard/work'],
    ],
  },
  {
    title: 'Newsroom',
    links: [
      ...(['Models', 'Agents', 'Analysis', 'Policy', 'Hardware', 'Funding', 'Tools'].map(
        (c) => [c, `/news/category/${c.toLowerCase()}`] as [string, string],
      )),
      ['اخبار هوش مصنوعی (FA)', '/news/fa'],
    ],
  },
  {
    title: 'Tools Directory',
    links: [
      ['AI agent tools', '/tools/category/agents'],
      ['AI coding tools', '/tools/category/coding'],
      ['AI research tools', '/tools/category/research'],
      ['AI image generators', '/tools/category/image'],
      ['AI video tools', '/tools/category/video'],
      ['AI voice & audio', '/tools/category/audio'],
      ['AI productivity', '/tools/category/productivity'],
      ['Free AI tools', '/tools/collection/free'],
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
              The fastest, lowest-cost AI API gateway — one key, pass-through pricing, live rankings, and bilingual AI news.
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
        <div aria-hidden="true" className="sf footer-wordmark">
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
          <span className="footer-bottom-links">
            <Link href="/" style={{ color: 'var(--vg-ink)' }}>
              English
            </Link>
            <Link href="/fa" className="fa-ui" lang="fa" dir="rtl" style={{ color: 'var(--vg-sand)' }}>
              فارسی
            </Link>
            <Link href="/news/fa" className="fa-ui" lang="fa" dir="rtl" style={{ color: 'var(--vg-ink2)' }}>
              اخبار فارسی
            </Link>
            <Link href="/privacy" style={{ color: 'var(--vg-ink3)' }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: 'var(--vg-ink3)' }}>
              Terms
            </Link>
            <a href="/feed.xml" style={{ color: 'var(--vg-ink3)' }}>
              RSS
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
