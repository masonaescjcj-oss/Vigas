import Link from 'next/link';
import type { CSSProperties } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { formatCompact, formatPricePerMillion, timeAgo, type ModelListItem } from '@vigas/core';
import { Colonnade } from '@/components/colonnade';
import { HeroApiPanel } from '@/components/hero-api-panel';
import { NewsletterForm } from '@/components/newsletter-form';
import { SiteHeader } from '@/components/site-header';
import { ArrowLink, Avatar, Icon, JsonLd, OrgMark, SectionHead, ToolMark } from '@/components/ui';
import { getHomeFeed, getLeaderboardData, getModels, getNews, getTools } from '@/lib/data';
import { articleImageUrl } from '@/lib/media';
import { organizationLd, pageMetadata, websiteLd } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'ویگاس — ارزان‌ترین و سریع‌ترین API هوش مصنوعی، لیدربورد و اخبار AI',
  absoluteTitle: true,
  description:
    'دسترسی یکپارچه به تمام مدل‌های برتر هوش مصنوعی با کمترین تعرفه مستقیم توکن، پایین‌ترین تأخیر لبه، رده‌بندی زنده Arena، اخبار تخصصی AI به فارسی و فهرست ابزارها.',
  path: '/fa',
  locale: 'fa_IR',
  alternatesLanguages: { en: '/', fa: '/fa', 'x-default': '/' },
});

const line = '1px solid var(--vg-line)';

const FA_CATS: Record<string, string> = {
  Models: 'مدل‌ها',
  Agents: 'ایجنت‌ها',
  Analysis: 'تحلیل',
  Policy: 'سیاست‌گذاری',
  Hardware: 'سخت‌افزار',
  Funding: 'سرمایه‌گذاری',
  Tools: 'ابزارها',
};

const FA_FLAGS: Record<string, string> = {
  Breaking: 'فوری',
  Analysis: 'تحلیل',
  Exclusive: 'اختصاصی',
};

function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

function faAgo(iso: string, now: Date): string {
  const t = timeAgo(iso, now);
  if (t === 'now') return 'هم‌اکنون';
  const m = /^(\d+)\s*(min|m|h|d|w)$/i.exec(t);
  if (!m) return t;
  const units: Record<string, string> = { min: 'دقیقه پیش', m: 'دقیقه پیش', h: 'ساعت پیش', d: 'روز پیش', w: 'هفته پیش' };
  return `${toFaDigits(m[1]!)} ${units[m[2]!.toLowerCase()] ?? ''}`;
}

const priceChange = (m: ModelListItem) =>
  m.priceChange24h < 0
    ? { text: `▼ ${Math.abs(m.priceChange24h)}%`, color: 'var(--vg-green)' }
    : m.priceChange24h > 0
      ? { text: `▲ ${m.priceChange24h}%`, color: 'var(--vg-red)' }
      : { text: '—', color: 'var(--vg-ink3)' };

export default async function PersianHomePage() {
  'use cache';
  cacheLife('content');
  cacheTag('news', 'leaderboard', 'models', 'tools');

  const [feed, models, news, tools, board] = await Promise.all([
    getHomeFeed({ lang: 'fa' }),
    getModels(),
    getNews({ lang: 'fa', limit: 9 }),
    getTools({ sort: 'votes' }),
    getLeaderboardData('overall'),
  ]);
  const providers = new Set(models.map((m) => m.org)).size;
  const sessions = formatCompact(board.totalSessions);
  const now = new Date();
  const today = now.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const [lead, ...restNews] = news.items;
  const secondary = restNews.slice(0, 3);
  const rail = restNews.slice(3, 8);
  const routeModels = ['deepseek/v4.1-flash', 'anthropic/claude-sonnet-5.5', 'google/gemini-4-argon', 'openai/gpt-6.1-terra']
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelListItem => Boolean(m));
  const routeMeta = [
    { ms: '291 ms', w: '34%', st: 'Rate-limited', sc: 'var(--vg-red)', bar: '#4A4540', bg: 'transparent' },
    { ms: '412 ms', w: '48%', st: 'Selected', sc: 'var(--vg-orange-text)', bar: 'var(--vg-orange)', bg: 'rgba(255,106,26,.08)' },
    { ms: '538 ms', w: '63%', st: 'Standby', sc: 'var(--vg-ink3)', bar: '#4A4540', bg: 'transparent' },
    { ms: '604 ms', w: '71%', st: 'Standby', sc: 'var(--vg-ink3)', bar: '#4A4540', bg: 'transparent' },
  ];

  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <SiteHeader active="home" lang="fa" />
      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: line }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(239,234,225,.13) 1px,transparent 1.3px)',
              backgroundSize: '24px 24px',
              WebkitMaskImage: 'radial-gradient(ellipse 55% 75% at 20% 40%,#000 15%,transparent 72%)',
              maskImage: 'radial-gradient(ellipse 55% 75% at 20% 40%,#000 15%,transparent 72%)',
            }}
          />
          <div className="wrap hero-inner">
            <div style={{ flex: '1 1 540px', minWidth: 0 }}>
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span className="led" />
                {toFaDigits(models.length)} مدل فعال · {toFaDigits(providers)} ارائه‌دهنده · کمترین تعرفه مستقیم API
              </div>
              <h1 style={{ fontSize: 'clamp(36px,5.4vw,68px)', lineHeight: 1.18, fontWeight: 700, margin: '18px 0 20px' }}>
                سریع‌ترین API.
                <br />
                <em className="hi" style={{ color: 'var(--vg-sand)' }}>ارزان‌ترین نرخ</em> توکن در بازار.
              </h1>
              <p style={{ fontSize: 'clamp(15px,1.4vw,17.5px)', color: 'var(--vg-ink2)', maxWidth: 580, margin: '0 0 24px', lineHeight: 1.85 }}>
                با یک کلید API سازگار با استاندارد OpenAI به همه مدل‌های پیشتاز متصل شوید؛ با مسیریابی لبه زیر ۱۲۰ میلی‌ثانیه، جابه‌جایی خودکار هنگام خطا و
                تعرفه خالص کارخانه — با ۰٪ کارمزد در ۵ دلار اول.
              </p>
              <HeroApiPanel models={models} lang="fa" />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
                <Link href="/signup?next=/dashboard%23keys" className="btn key" style={{ minHeight: 50, padding: '0 24px', fontSize: 15 }}>
                  دریافت کلید API
                  <Icon name="arrow" size={16} style={{ transform: 'scaleX(-1)' }} />
                </Link>
                <Link href="/models" className="btn gh" style={{ minHeight: 50, padding: '0 24px', fontSize: 15 }}>
                  مشاهده {toFaDigits(models.length)} مدل و قیمت‌های زنده
                </Link>
              </div>
            </div>

            <div style={{ flex: '1 1 440px', minWidth: 0 }}>
              <figure
                dir="ltr"
                aria-label="نمونه درخواست مسیریابی‌شده با vigas/auto"
                style={{ margin: 0, background: 'var(--vg-bg2)', border: '1px solid var(--vg-line2)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 80px -40px rgba(0,0,0,.8)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: line }}>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-on-orange)', background: 'var(--vg-sand)', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                    POST
                  </span>
                  <span className="mn" style={{ fontSize: 13, color: 'var(--vg-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    api.vigas.ai/v1/chat/completions
                  </span>
                  <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span className="led" />
                    200 OK
                  </span>
                </div>
                <pre
                  className="mn"
                  style={{ margin: 0, padding: '18px 20px', background: 'var(--vg-code)', fontSize: 13, lineHeight: 1.75, color: '#D9D3C7', overflowX: 'auto', borderBottom: line }}
                >
                  <span style={{ color: 'var(--vg-ink3)' }}>{'{'}</span>
                  {'\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;model&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;vigas/auto&quot;</span>,{'\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;route&quot;</span>: {'{ '}
                  <span style={{ color: '#FF8A4C' }}>&quot;sort&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;latency&quot;</span>,{' '}
                  <span style={{ color: '#FF8A4C' }}>&quot;fallbacks&quot;</span>: <span style={{ color: '#A5A8FF' }}>true</span>
                  {' },\n  '}
                  <span style={{ color: '#FF8A4C' }}>&quot;messages&quot;</span>: [{'{ '}
                  <span style={{ color: '#FF8A4C' }}>&quot;role&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;user&quot;</span>,{' '}
                  <span style={{ color: '#FF8A4C' }}>&quot;content&quot;</span>: <span style={{ color: '#A6D49F' }}>&quot;Summarize this contract&quot;</span>
                  {' }]\n'}
                  <span style={{ color: 'var(--vg-ink3)' }}>{'}'}</span>
                </pre>
                <div style={{ padding: '16px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="lbl">Routing</span>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {routeModels.length} candidates
                  </span>
                </div>
                <div style={{ padding: '0 10px 10px' }}>
                  {routeModels.map((m, i) => {
                    const r = routeMeta[i]!;
                    return (
                      <div
                        key={m.id}
                        style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) 92px', gap: 12, alignItems: 'center', padding: '10px 8px', borderRadius: 12, background: r.bg }}
                      >
                        <OrgMark org={m.org} size={30} radius={9} fontSize={13} />
                        <div style={{ minWidth: 0 }}>
                          <div className="mn" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.id}
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--vg-raised)', marginTop: 7, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: r.w, background: r.bar, borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="mn" style={{ fontSize: 13 }}>
                            {r.ms}
                          </div>
                          <div style={{ fontSize: 12, color: r.sc }}>{r.st}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderTop: line }}>
                  {[
                    ['Tokens', '1,284', undefined],
                    ['Cost', '$0.0041', 'var(--vg-green)'],
                    ['Latency', '0.41 s', undefined],
                  ].map(([k, v, c], i) => (
                    <div key={k} style={{ padding: '14px 18px', borderLeft: i ? line : undefined }}>
                      <div className="lbl">{k}</div>
                      <div className="mn" style={{ fontSize: 16, marginTop: 4, color: c }}>
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
                <figcaption className="sr-only">نمونه مسیریابی هوشمند درخواست بین چهار مدل</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── Numbers ──────────────────────────────────────────────────── */}
        <section aria-label="آمار ویگاس" style={{ borderBottom: line }}>
          <div className="stats">
            {[
              [toFaDigits(models.length), 'مدل آنلاین در گیت‌وی'],
              [toFaDigits(providers), 'آزمایشگاه و ارائه‌دهنده'],
              [sessions, 'نشست ارزیابی Arena'],
              ['۰٪', 'کارمزد اضافی تا ۵ دلار اول'],
            ].map(([big, label]) => (
              <div key={label}>
                <div className="stat-val" dir="ltr" style={{ display: 'inline-block', fontWeight: 700 }}>
                  {big}
                </div>
                <div className="lbl" style={{ marginTop: 8 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── § 01 Platform ────────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="platform-fa">
          <div className="wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 36 }}>
              <div>
                <div className="lbl">§ ۰۱ — زیرساخت و بخش‌های ویگاس</div>
                <h2 id="platform-fa" style={{ fontSize: 'clamp(30px,3.8vw,48px)', lineHeight: 1.22, fontWeight: 700, margin: '12px 0 0' }}>
                  چهار بخش کلیدی. <em className="hi">یک حساب و کمترین تعرفه.</em>
                </h2>
              </div>
              <p style={{ maxWidth: 460, color: 'var(--vg-ink2)', margin: 0, lineHeight: 1.8 }}>
                عملکرد واقعی مدل‌ها را در لیدربورد مقایسه کنید، اخبار تحلیل‌شده هوش مصنوعی را بخوانید، بهترین ابزارها را بشناسید و با ارزان‌ترین API به تولید بروید.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link href="/models" className="lift bento-card" style={{ flex: '2 1 520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="lbl">۰۱ · گیت‌وی API سریع و ارزان</span>
                  <span style={{ fontSize: 12, color: 'var(--vg-orange)', background: 'var(--vg-orange-soft)', borderRadius: 6, padding: '3px 8px' }}>
                    سازگار با OpenAI
                  </span>
                </div>
                <h3 style={{ fontSize: 'clamp(24px,2.6vw,32px)', lineHeight: 1.25, margin: 0, fontWeight: 700 }}>
                  همه مدل‌های برتر پشت <em className="hi">یک آدرس API.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', maxWidth: 520, lineHeight: 1.75 }}>
                  شارژ اعتباری شفاف، انتقال دقیق تعرفه اصلی آزمایشگاه‌ها بدون کارمزد پنهان، و Failover خودکار در چند میلی‌ثانیه.
                </p>
                <div dir="ltr" style={{ marginTop: 'auto', border: line, borderRadius: 14, overflow: 'hidden', background: 'var(--vg-bg2)' }}>
                  {feed.prices.slice(0, 3).map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) minmax(56px,auto) minmax(56px,auto)',
                        gap: 10,
                        alignItems: 'center',
                        padding: '11px 16px',
                        borderTop: i ? '1px solid rgba(239,234,225,.06)' : undefined,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <OrgMark org={m.org} size={22} radius={6} fontSize={11} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      </span>
                      <span className="mn" style={{ fontSize: 13, textAlign: 'right', color: 'var(--vg-ink2)' }}>
                        {formatPricePerMillion(m.inputPerMillionMicros)}
                      </span>
                      <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                        {formatPricePerMillion(m.outputPerMillionMicros)}
                      </span>
                    </div>
                  ))}
                </div>
              </Link>

              <Link href="/leaderboard" className="lift bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">۰۲ · لیدربورد زنده Arena</span>
                <h3 style={{ fontSize: 26, lineHeight: 1.28, margin: 0, fontWeight: 700 }}>
                  رتبه‌بندی بر پایه <em className="hi">آزمون واقعی.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: 1.75 }}>
                  سهم برد از {sessions} نشست و رأی کور کاربران Arena به‌جای بنچمارک‌های تکراری.
                </p>
                <div
                  aria-hidden="true"
                  dir="ltr"
                  style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 10, height: 112, padding: '0 6px', borderBottom: '1px solid var(--vg-line2)' }}
                >
                  {feed.topAgents.slice(0, 6).map((a, i) => {
                    const max = feed.topAgents[0]?.winRate || 1;
                    const bg =
                      i === 0
                        ? 'repeating-linear-gradient(90deg,#FF6A1A 0 5px,#D9530C 5px 6px)'
                        : i < 3
                          ? 'repeating-linear-gradient(90deg,#E3B65C 0 5px,#B88E3F 5px 6px)'
                          : 'var(--vg-pillar)';
                    return <span key={a.modelId} style={{ flex: 1, height: `${Math.round((a.winRate / max) * 100)}%`, background: bg, borderRadius: '3px 3px 0 0' }} />;
                  })}
                </div>
              </Link>

              <Link href="/news/fa" className="lift bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">۰۳ · اخبار فارسی هوش مصنوعی</span>
                <h3 style={{ fontSize: 26, lineHeight: 1.28, margin: 0, fontWeight: 700 }}>
                  اخباری که <em className="hi">بازار مدل‌ها را تکان می‌دهد.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: 1.75 }}>
                  گزارش‌های تحلیلی اختصاصی به زبان فارسی با اتصال مستقیم به آمار تعرفه و رتبه‌بندی ویگاس.
                </p>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {feed.news.slice(0, 2).map((n) => (
                    <div key={n.slug} style={{ padding: '9px 0', borderTop: line }}>
                      <div style={{ fontSize: 12, color: 'var(--vg-orange)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{FA_CATS[n.category] ?? n.category}</span>
                        <span style={{ color: 'var(--vg-ink3)' }}>· {faAgo(n.publishedAt, now)}</span>
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 600, marginTop: 3 }}>
                        {n.title}
                      </div>
                    </div>
                  ))}
                </div>
              </Link>

              <Link href="/tools" className="lift bento-card" style={{ flex: '1.2 1 340px' }}>
                <span className="lbl">۰۴ · دایرکتوری ابزارهای AI</span>
                <h3 style={{ fontSize: 26, lineHeight: 1.28, margin: 0, fontWeight: 700 }}>
                  {toFaDigits(tools.length)} ابزار برتر، <em className="hi">با رأی سازندگان.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: 1.75 }}>
                  معرفی و مقایسه ابزارهای کدنویسی، تصویر، ویدیو، صدا و پژوهش با آیکون و تصویر واقعی.
                </p>
                <div aria-hidden="true" dir="ltr" style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                  {tools.slice(0, 8).map((t) => (
                    <ToolMark
                      key={t.slug}
                      slug={t.slug}
                      iconUrl={t.iconUrl}
                      color={t.color}
                      letter={t.letter}
                      size={44}
                      radius={12}
                      fontSize={18}
                      style={{ width: '100%', height: 'auto', aspectRatio: '1' }}
                    />
                  ))}
                </div>
              </Link>

              <div className="bento-card" style={{ flex: '1 1 320px' }}>
                <span className="lbl">همه‌جا · نسخه اندروید</span>
                <h3 style={{ fontSize: 26, lineHeight: 1.28, margin: 0, fontWeight: 700 }}>
                  ویگاس، <em className="hi">در جیب شما.</em>
                </h3>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: 1.75 }}>
                  مانیتورینگ مصرف API، رتبه‌بندی مدل‌ها، اخبار روز و کیف پول اعتباری — سریع و بومی.
                </p>
                <span className="btn gh" style={{ marginTop: 'auto', alignSelf: 'flex-start', cursor: 'default' }}>
                  <Icon name="phone" size={16} />
                  اپ اندروید · به‌زودی
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── § 02 Live market ─────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="market-fa">
          <div className="wrap">
            <div style={{ marginBottom: 36 }}>
              <div className="lbl">§ ۰۲ — بازار زنده مدل‌ها</div>
              <h2 id="market-fa" style={{ fontSize: 'clamp(30px,3.8vw,48px)', lineHeight: 1.2, fontWeight: 700, margin: '12px 0 0' }}>
                تعرفه‌های لحظه‌ای و رتبه‌بندی، <em className="hi">به‌روزرسانی دقیقه‌ای.</em>
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 520px', minWidth: 0, background: 'var(--vg-surface)', border: line, borderRadius: 22, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: line, gap: 10 }}>
                  <h3 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>تعرفه‌های زنده API</h3>
                  <span className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="led" />
                    به‌ازای ۱ میلیون توکن
                  </span>
                </div>
                <div dir="ltr">
                  <div
                    aria-hidden="true"
                    className="mn live-prices-grid"
                    style={{ paddingTop: 10, paddingBottom: 10, fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--vg-bg2)' }}
                  >
                    <span>Model</span>
                    <span style={{ textAlign: 'right' }}>Input</span>
                    <span style={{ textAlign: 'right' }}>Output</span>
                    <span className="col-24h" style={{ textAlign: 'right' }}>24h</span>
                  </div>
                  {feed.prices.map((m) => {
                    const chg = priceChange(m);
                    return (
                      <Link
                        key={m.id}
                        href={`/models?q=${encodeURIComponent(m.id)}`}
                        className="hov live-prices-grid"
                        style={{ paddingTop: 13, paddingBottom: 13, borderTop: '1px solid rgba(239,234,225,.06)', color: 'var(--vg-ink)' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <OrgMark org={m.org} size={30} radius={9} fontSize={15} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                            <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.id}
                            </span>
                          </span>
                        </span>
                        <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                          {formatPricePerMillion(m.inputPerMillionMicros)}
                        </span>
                        <span className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
                          {formatPricePerMillion(m.outputPerMillionMicros)}
                        </span>
                        <span className="mn col-24h" style={{ fontSize: 12, textAlign: 'right', color: chg.color }}>
                          {chg.text}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <div style={{ padding: '14px 22px', borderTop: line }}>
                  <ArrowLink href="/models">مشاهده کامل {toFaDigits(models.length)} مدل و قیمت‌ها</ArrowLink>
                </div>
              </div>

              <div style={{ flex: '1 1 520px', minWidth: 0, background: 'var(--vg-surface)', border: line, borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>ستون قهرمانان Arena</h3>
                  <span style={{ fontSize: 12, color: 'var(--vg-ink2)', border: '1px solid var(--vg-line2)', borderRadius: 6, padding: '3px 8px' }}>
                    برترین مدل‌ها · سهم برد این هفته
                  </span>
                </div>
                <div dir="ltr" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Colonnade entries={feed.topAgents} />
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: line }}>
                  <ArrowLink href="/leaderboard">مشاهده لیدربورد کامل</ArrowLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── § 03 News (Strict Persian only) ──────────────────────────── */}
        {lead && (
          <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="today-fa">
            <div className="wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
                <div>
                  <div className="lbl">§ ۰۳ — اخبار امروز هوش مصنوعی · {today}</div>
                  <h2 id="today-fa" style={{ fontSize: 'clamp(30px,3.8vw,48px)', lineHeight: 1.2, fontWeight: 700, margin: '12px 0 0' }}>
                    خبرهایی که <em className="hi">بازار مدل‌ها</em> را شکل می‌دهند
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href="/news" dir="ltr" lang="en" className="mn pill" style={{ color: 'var(--vg-sand)' }}>
                    English Newsroom
                  </Link>
                  <ArrowLink href="/news/fa" style={{ fontSize: 15 }}>
                    تمام اخبار فارسی
                  </ArrowLink>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
                <article className="st" style={{ flex: '1.5 1 460px', minWidth: 0 }}>
                  <Link href={`/news/${lead.slug}`} style={{ display: 'block', color: 'var(--vg-ink)' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 16, overflow: 'hidden', border: line, background: '#151411' }}>
                      <img
                        src={articleImageUrl(lead.slug, lead.imageUrl)}
                        alt={lead.title}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {lead.flag && (
                        <span style={badge(lead.flag)}>
                          {FA_FLAGS[lead.flag] ?? lead.flag}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: 'var(--vg-orange)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{FA_CATS[lead.category] ?? lead.category}</span>
                      <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {faAgo(lead.publishedAt, now)}</span>
                    </div>
                    <h3
                      className="hl"
                      style={{
                        fontSize: 'clamp(24px,2.5vw,32px)',
                        lineHeight: 1.4,
                        margin: '10px 0',
                        fontWeight: 700,
                      }}
                    >
                      {lead.title}
                    </h3>
                    <p style={{ margin: '0 0 12px', color: 'var(--vg-ink2)', fontSize: 15.5, lineHeight: 1.8 }}>{lead.dek}</p>
                    <div style={{ fontSize: 12, color: 'var(--vg-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={lead.author.name} color={lead.author.color} />
                      {lead.author.name} · {toFaDigits(lead.readingMinutes)} دقیقه مطالعه
                    </div>
                  </Link>
                </article>

                <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {secondary.map((n) => (
                    <article key={n.slug} className="st" style={{ padding: '0 0 20px', marginBottom: 20, borderBottom: line }}>
                      <Link href={`/news/${n.slug}`} style={{ display: 'flex', gap: 16, color: 'var(--vg-ink)', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--vg-orange)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>{FA_CATS[n.category] ?? n.category}</span>
                            <span style={{ color: 'var(--vg-ink3)', fontWeight: 500 }}>· {faAgo(n.publishedAt, now)}</span>
                          </div>
                          <h3
                            className="hl"
                            style={{
                              fontSize: 18,
                              lineHeight: 1.48,
                              margin: '6px 0 8px',
                              fontWeight: 600,
                            }}
                          >
                            {n.title}
                          </h3>
                          <div style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                            {n.author.name}
                          </div>
                        </div>
                        <div style={{ width: 112, height: 112, flexShrink: 0, borderRadius: 14, overflow: 'hidden', border: line, background: '#151411' }}>
                          <img
                            src={articleImageUrl(n.slug, n.imageUrl)}
                            alt={n.title}
                            width={112}
                            height={112}
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>

                {rail.length > 0 && (
                  <aside style={{ flex: '1 1 280px', minWidth: 0 }} aria-label="اخبار بیشتر">
                    <div className="lbl" style={{ marginBottom: 6 }}>
                      § گزارش‌های بیشتر
                    </div>
                    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {rail.map((n, i) => (
                        <li key={n.slug}>
                          <Link
                            href={`/news/${n.slug}`}
                            style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, padding: '14px 0', borderBottom: line, color: 'var(--vg-ink)' }}
                          >
                            <span className="mn" aria-hidden="true" style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--vg-orange)', fontWeight: 600 }}>
                              {toFaDigits(i + 1)}
                            </span>
                            <span>
                              <span style={{ display: 'block', fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>
                                {n.title}
                              </span>
                              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 6 }}>
                                <span>{FA_CATS[n.category] ?? n.category} · {faAgo(n.publishedAt, now)}</span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </aside>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── § 04 Tools ───────────────────────────────────────────────── */}
        <section className="sec-pad" style={{ borderBottom: line }} aria-labelledby="trending-fa">
          <div className="wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
              <div>
                <div className="lbl">§ ۰۴ — ابزارهای محبوب هفته</div>
                <h2 id="trending-fa" style={{ fontSize: 'clamp(30px,3.8vw,48px)', lineHeight: 1.2, fontWeight: 700, margin: '12px 0 0' }}>
                  ابزارهایی که توسعه‌دهندگان <em className="hi">رأی داده‌اند</em>
                </h2>
              </div>
              <ArrowLink href="/tools" style={{ fontSize: 15 }}>
                دایرکتوری کامل ابزارها
              </ArrowLink>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 16 }}>
              {feed.trendingTools.slice(0, 4).map((t, i) => (
                <Link
                  key={t.slug}
                  href={`/tools/${t.slug}`}
                  className="lift"
                  style={{ background: 'var(--vg-surface)', border: line, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--vg-ink)', minWidth: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="mn" aria-hidden="true" style={{ fontSize: 32, lineHeight: 1, color: 'var(--vg-strong)', fontWeight: 700 }}>
                      ۰{toFaDigits(i + 1)}
                    </span>
                    <span className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="up" size={14} />
                      {t.votes.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ToolMark slug={t.slug} iconUrl={t.iconUrl} color={t.color} letter={t.letter} size={46} radius={13} fontSize={22} />
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>{t.name}</span>
                      <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                        {t.category} · ★ {t.rating.toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.65 }}>{t.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Newsletter ───────────────────────────────────────────────── */}
        <section className="sec-pad" aria-labelledby="daily-token-fa">
          <div className="wrap">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 40,
                alignItems: 'center',
                padding: 'clamp(24px,4vw,56px)',
                borderRadius: 28,
                background: 'var(--vg-surface)',
                border: line,
              }}
            >
              <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                <div className="lbl">§ خبرنامه روزانه The Daily Token</div>
                <h2 id="daily-token-fa" style={{ fontSize: 'clamp(28px,3.6vw,44px)', lineHeight: 1.24, fontWeight: 700, margin: '12px 0' }}>
                  پنج دقیقه مطالعه. <em className="hi">هر مدل مهمی که باید بشناسید.</em>
                </h2>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: 1.75 }}>
                  رونمایی‌های جدید، کاهش قیمت API و نمودارهای کلیدی هر هفته در ایمیل شما.
                </p>
              </div>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <NewsletterForm lang="fa" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function badge(flag: string): CSSProperties {
  return {
    position: 'absolute',
    right: 14,
    top: 14,
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    background: flag === 'Analysis' ? 'var(--vg-sand)' : 'var(--vg-orange)',
    color: 'var(--vg-on-orange)',
  };
}
