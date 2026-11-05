import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { getHomeFeed, getModels } from '@/lib/data';
import { HeaderAccount } from './header-account';
import { QuickSearch } from './quick-search';
import { LogoMark } from './ui';

export type NavKey = 'home' | 'models' | 'chat' | 'leaderboard' | 'news' | 'tools' | 'retrobuild' | 'none';

const NAV: Array<[NavKey, string, string]> = [
  ['models', 'Models', '/models'],
  ['chat', 'Chat', '/chat'],
  ['leaderboard', 'Leaderboard', '/leaderboard'],
  ['news', 'News', '/news'],
  ['tools', 'Tools', '/tools'],
  ['retrobuild', 'RetroBuild', '/retrobuild'],
];

export function SiteHeader({ active = 'none', ticker = true }: { active?: NavKey; ticker?: boolean }) {
  return (
    <>
      <header className="site-header">
        <div className="hdr">
          <Link href="/" aria-label="Vigas home" className="hdr-logo">
            <LogoMark />
            <span className="sf" style={{ fontSize: 27, lineHeight: 1, letterSpacing: '-.01em' }}>
              Vigas
            </span>
          </Link>
          <nav aria-label="Primary" className="hdr-nav">
            {NAV.map(([id, label, href]) => (
              <Link key={id} href={href} aria-current={id === active ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hdr-actions">
            <QuickSearch />
            <HeaderAccount />
          </div>
        </div>
      </header>
      {ticker && <Ticker />}
    </>
  );
}

interface TickerItem {
  k: string;
  c: string;
  text: string;
  href: string;
}

async function Ticker() {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'leaderboard', 'models', 'tools');
  const [feed, models] = await Promise.all([getHomeFeed(), getModels()]);
  const items: TickerItem[] = [];
  const news = feed.news;
  if (news[0]) items.push({ k: news[0].category.toUpperCase(), c: 'var(--vg-orange)', text: news[0].title, href: `/news/${news[0].slug}` });
  const drop = [...models].sort((a, b) => a.priceChange24h - b.priceChange24h)[0];
  if (drop && drop.priceChange24h < 0) {
    items.push({ k: `▼ ${Math.abs(drop.priceChange24h)}%`, c: 'var(--vg-green)', text: `${drop.name} input price`, href: '/models' });
  }
  const top = feed.topAgents[0];
  if (top) items.push({ k: '#1', c: 'var(--vg-sand)', text: `${top.name.replace(/ \(.*\)$/, '')} · ${top.winRate.toFixed(2)}% win share`, href: '/leaderboard' });
  if (news[1]) items.push({ k: news[1].category.toUpperCase(), c: 'var(--vg-orange)', text: news[1].title, href: `/news/${news[1].slug}` });
  const tool = feed.trendingTools[0];
  if (tool) items.push({ k: 'TOOLS', c: 'var(--vg-teal)', text: `${tool.name} tops the tools directory this week`, href: `/tools/${tool.slug}` });
  for (const n of news.slice(2, 4)) items.push({ k: n.category.toUpperCase(), c: 'var(--vg-orange)', text: n.title, href: `/news/${n.slug}` });
  if (items.length === 0) return null;

  const row = (copy: boolean) =>
    items.map((t, i) => (
      <Link key={`${copy ? 'b' : 'a'}${i}`} href={t.href} tabIndex={copy ? -1 : undefined}>
        <b className="mn" style={{ fontSize: 12, fontWeight: 500, marginRight: 8, color: t.c }}>
          {t.k}
        </b>
        {t.text}
      </Link>
    ));

  return (
    <section className="ticker" aria-label="Live updates">
      <div className="ticker-live" aria-hidden="true">
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vg-on-orange)', display: 'inline-block' }} />
        LIVE
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {row(false)}
          <span aria-hidden="true" style={{ display: 'contents' }}>
            {row(true)}
          </span>
        </div>
      </div>
    </section>
  );
}
