import Link from 'next/link';
import { Suspense } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { getHomeFeed, getModels } from '@/lib/data';
import { HeaderAccount } from './header-account';
import { MobileNav } from './mobile-nav';
import { QuickSearch } from './quick-search';
import { Icon, LogoMark } from './ui';

export type NavKey = 'home' | 'models' | 'leaderboard' | 'news' | 'tools' | 'none';

const EN_NAV: Array<[NavKey, string, string]> = [
  ['models', 'Models & API', '/models'],
  ['leaderboard', 'Leaderboard', '/leaderboard'],
  ['news', 'News', '/news'],
  ['tools', 'Tools', '/tools'],
];

const FA_NAV: Array<[NavKey, string, string]> = [
  ['models', 'مدل‌ها و تعرفه', '/models'],
  ['leaderboard', 'لیدربورد', '/leaderboard'],
  ['news', 'اخبار AI', '/news/fa'],
  ['tools', 'ابزارها', '/tools'],
];

export function SiteHeader({
  active = 'none',
  ticker = true,
  lang = 'en',
  altHref,
}: {
  active?: NavKey;
  ticker?: boolean;
  lang?: 'en' | 'fa';
  altHref?: string;
}) {
  const isFa = lang === 'fa';
  const nav = isFa ? FA_NAV : EN_NAV;
  const homeHref = isFa ? '/fa' : '/';
  const enHref = isFa ? (altHref ?? (active === 'news' ? '/news' : '/')) : active === 'news' ? '/news' : '/';
  const faHref = isFa ? (active === 'news' ? '/news/fa' : '/fa') : (altHref ?? (active === 'news' ? '/news/fa' : '/fa'));

  return (
    <>
      <header className="site-header">
        <div className="hdr">
          <Suspense
            fallback={
              <span className="hdr-menu hdr-menu-pill" aria-hidden="true">
                <LogoMark size={20} />
                <span className="sf" style={{ fontSize: 23, lineHeight: 1 }}>
                  Vigas
                </span>
                <Icon name="chevDown" size={14} className="hdr-menu-chev" />
              </span>
            }
          >
            <MobileNav active={active} nav={nav} lang={lang} enHref={enHref} faHref={faHref} />
          </Suspense>
          <Link href={homeHref} aria-label={isFa ? 'صفحه اصلی ویگاس' : 'Vigas home'} className="hdr-logo">
            <LogoMark />
            <span className="sf" style={{ fontSize: 27, lineHeight: 1, letterSpacing: '-.01em' }}>
              Vigas
            </span>
          </Link>
          <nav aria-label={isFa ? 'منوی اصلی' : 'Primary'} className="hdr-nav">
            {nav.map(([id, label, href]) => (
              <Link key={id} href={href} aria-current={id === active ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hdr-actions">
            <div className="hdr-lang" role="group" aria-label={isFa ? 'انتخاب زبان' : 'Language switcher'}>
              <Link href={enHref} aria-current={!isFa ? 'page' : undefined} title="English">
                EN
              </Link>
              <Link href={faHref} lang="fa" className="fa-ui" aria-current={isFa ? 'page' : undefined} title="نسخه فارسی">
                فا
              </Link>
            </div>
            <QuickSearch lang={lang} />
            <HeaderAccount lang={lang} />
          </div>
        </div>
      </header>
      {ticker && <Ticker lang={lang} />}
    </>
  );
}

interface TickerItem {
  k: string;
  c: string;
  text: string;
  href: string;
  lang?: 'en' | 'fa';
}

async function Ticker({ lang = 'en' }: { lang?: 'en' | 'fa' }) {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'leaderboard', 'models', 'tools');
  const [feed, models] = await Promise.all([getHomeFeed({ lang }), getModels()]);
  const isFa = lang === 'fa';
  const items: TickerItem[] = [];
  const news = feed.news;
  if (news[0]) items.push({ k: news[0].category.toUpperCase(), c: 'var(--vg-orange)', text: news[0].title, href: `/news/${news[0].slug}`, lang: news[0].lang });
  const drop = [...models].sort((a, b) => a.priceChange24h - b.priceChange24h)[0];
  if (drop && drop.priceChange24h < 0) {
    items.push({
      k: `▼ ${Math.abs(drop.priceChange24h)}%`,
      c: 'var(--vg-green)',
      text: isFa ? `کاهش تعرفه API مدل ${drop.name}` : `${drop.name} API price`,
      href: '/models',
      lang,
    });
  }
  const top = feed.topAgents[0];
  if (top) {
    items.push({
      k: '#1',
      c: 'var(--vg-sand)',
      text: isFa ? `${top.name.replace(/ \(.*\)$/, '')} · ${top.winRate.toFixed(2)}% سهم برد` : `${top.name.replace(/ \(.*\)$/, '')} · ${top.winRate.toFixed(2)}% win share`,
      href: '/leaderboard',
      lang,
    });
  }
  if (news[1]) items.push({ k: news[1].category.toUpperCase(), c: 'var(--vg-orange)', text: news[1].title, href: `/news/${news[1].slug}`, lang: news[1].lang });
  const tool = feed.trendingTools[0];
  if (tool) {
    items.push({
      k: 'TOOLS',
      c: 'var(--vg-teal)',
      text: isFa ? `${tool.name} در صدر دایرکتوری ابزارها` : `${tool.name} tops the tools directory this week`,
      href: `/tools/${tool.slug}`,
      lang,
    });
  }
  for (const n of news.slice(2, 4)) items.push({ k: n.category.toUpperCase(), c: 'var(--vg-orange)', text: n.title, href: `/news/${n.slug}`, lang: n.lang });
  if (items.length === 0) return null;

  const row = (copy: boolean) =>
    items.map((t, i) => (
      <Link key={`${copy ? 'b' : 'a'}${i}`} href={t.href} tabIndex={copy ? -1 : undefined}>
        <b className="mn" style={{ fontSize: 12, fontWeight: 500, marginRight: 8, color: t.c }}>
          {t.k}
        </b>
        <bdi dir={t.lang === 'fa' ? 'rtl' : 'ltr'} lang={t.lang ?? 'en'} className={t.lang === 'fa' ? 'fa-ui' : undefined}>
          {t.text}
        </bdi>
      </Link>
    ));

  return (
    <section className="ticker" aria-label={isFa ? 'به‌روزرسانی زنده' : 'Live updates'}>
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
