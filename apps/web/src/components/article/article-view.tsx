import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatPricePerMillion, type Article } from '@vigas/core';
import { orgMark } from '@vigas/tokens';
import { getArticleBySlug, getLeaderboardData, getModels, getNews } from '@/lib/data';
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/env';
import { markdownToText, renderArticleSections } from '@/lib/markdown';
import { breadcrumbLd, faqLd } from '@/lib/seo';
import { shortName } from '../colonnade';
import { CoverArt, TypoCover } from '../covers';
import { Avatar, Breadcrumb, Icon, JsonLd, Mark, SplitTitle } from '../ui';
import { ShareButton } from './share-button';

const DATA_CATEGORIES = new Set(['Models', 'Agents', 'Analysis', 'Tools']);

const FA_CATEGORIES: Record<string, string> = {
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

const fmtDate = (iso: string, isFa: boolean) =>
  new Date(iso).toLocaleString(isFa ? 'fa-IR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
const fmtTime = (iso: string, isFa: boolean) =>
  new Date(iso).toLocaleTimeString(isFa ? 'fa-IR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

export async function ArticleView({ slug }: { slug: string }) {
  'use cache';
  cacheLife('content');
  cacheTag('news', `article:${slug}`, 'leaderboard', 'models');

  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const [models, board, sameCategory, latest] = await Promise.all([
    getModels(),
    getLeaderboardData('overall'),
    getNews({ category: article.category, limit: 8 }),
    getNews({ limit: 12 }),
  ]);

  const lang = article.lang ?? 'en';
  const isFa = lang === 'fa';
  const categoryLabel = isFa ? (FA_CATEGORIES[article.category] ?? article.category) : article.category;
  const flagLabel = article.flag ? (isFa ? (FA_FLAGS[article.flag] ?? article.flag) : article.flag.toUpperCase()) : null;

  const url = absoluteUrl(`/news/${article.slug}`);
  const sections = renderArticleSections(article.body);
  const showData = DATA_CATEGORIES.has(article.category) || article.mentionedModelIds.length > 0;
  const top5 = board.entries.slice(0, 5);
  const rankOf = new Map(board.entries.map((e) => [e.modelId, e.rank]));
  const mentioned = article.mentionedModelIds.map((id) => models.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const sideModels = mentioned.length
    ? mentioned
    : top5.slice(0, 3).flatMap((e) => models.filter((m) => m.id === e.modelId));
  const related = [...sameCategory.items, ...latest.items]
    .filter((n, i, all) => n.slug !== article.slug && all.findIndex((x) => x.slug === n.slug) === i)
    .sort((a, b) => Number((b.lang ?? 'en') === lang) - Number((a.lang ?? 'en') === lang))
    .slice(0, 3);
  const updated = article.updatedAt !== article.publishedAt && new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 60_000;

  const toc: Array<{ id: string; text: string }> = [];
  sections.forEach((s, i) => {
    if (s.heading) toc.push(s.heading);
    if (showData && i === Math.min(1, sections.length - 1)) toc.push({ id: 'numbers', text: isFa ? 'اعداد کلیدی' : 'The numbers' });
  });
  if (article.faq.length) toc.push({ id: 'faq', text: isFa ? 'پرسش‌های متداول' : 'FAQ' });

  const categorySlug = article.category.toLowerCase();
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.dek,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      articleSection: article.category,
      wordCount: markdownToText(article.body).trim().split(/\s+/).filter(Boolean).length,
      inLanguage: lang,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
      image: [absoluteUrl(`/og/news/${article.slug}`)],
      author: [{ '@type': 'Person', name: article.author.name, jobTitle: article.author.role }],
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') } },
    },
    breadcrumbLd([
      { name: isFa ? 'خانه' : 'Home', path: '/' },
      { name: isFa ? 'اخبار' : 'News', path: '/news' },
      { name: categoryLabel, path: `/news/category/${categorySlug}` },
      { name: article.title, path: `/news/${article.slug}` },
    ]),
    ...(article.faq.length ? [faqLd(article.faq)] : []),
  ];

  const figures = (i: number): ReactNode => {
    const afterChart = i === Math.min(1, sections.length - 1);
    const afterKeys = i === Math.min(2, sections.length - 1);
    return (
      <>
        {showData && afterChart && <WinShareFigure entries={top5} isFa={isFa} />}
        {afterChart && article.pullQuote && <PullQuote quote={article.pullQuote} isFa={isFa} />}
        {showData && afterKeys && <KeyNumbers article={article} topShare={top5[0]?.winRate ?? null} modelCount={models.length} isFa={isFa} />}
      </>
    );
  };

  return (
    <>
      <JsonLd data={ld} />
      <article dir={isFa ? 'rtl' : 'ltr'} lang={lang} className={isFa ? 'fa-ui' : undefined}>
        <header style={{ maxWidth: 900, margin: '0 auto', padding: '40px var(--vg-gutter) 28px', textAlign: 'center' }}>
          <Breadcrumb
            center
            items={[
              { name: isFa ? 'خانه' : 'Home', href: '/' },
              { name: isFa ? 'اخبار' : 'News', href: isFa ? '/news?lang=fa' : '/news' },
              { name: categoryLabel, href: isFa ? `/news/category/${categorySlug}?lang=fa` : `/news/category/${categorySlug}`, accent: true },
            ]}
          />
          <div
            className={isFa ? 'fa-ui' : 'mn'}
            style={{
              marginTop: 26,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: isFa ? 0 : '.12em',
              color: 'var(--vg-orange)',
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {flagLabel && (
              <span style={{ padding: '2px 8px', borderRadius: 5, background: article.flag === 'Analysis' ? 'var(--vg-sand)' : 'var(--vg-orange)', color: 'var(--vg-on-orange)' }}>
                {flagLabel}
              </span>
            )}
            <Link href={isFa ? `/news/category/${categorySlug}?lang=fa` : `/news/category/${categorySlug}`} style={{ color: 'var(--vg-orange)' }}>
              {isFa ? categoryLabel : article.category.toUpperCase()}
            </Link>
            {showData ? (isFa ? ' · لیدربورد زنده' : ' · LEADERBOARD') : ''}
          </div>
          <h1
            className={isFa ? 'fa-ui' : 'sf'}
            style={{
              fontSize: isFa ? 'clamp(30px,4.4vw,52px)' : 'clamp(36px,5.6vw,76px)',
              lineHeight: isFa ? 1.32 : 1.02,
              letterSpacing: isFa ? 0 : '-.03em',
              fontWeight: isFa ? 700 : 400,
              margin: '18px 0',
            }}
          >
            <SplitTitle title={article.title} />
          </h1>
          <p
            className={isFa ? 'fa-ui' : 'sf'}
            style={{
              fontSize: isFa ? 'clamp(17px,1.5vw,20px)' : 'clamp(19px,1.8vw,23px)',
              color: 'var(--vg-ink2)',
              lineHeight: isFa ? 1.75 : 1.45,
              margin: '0 auto 26px',
              maxWidth: 720,
            }}
          >
            {article.dek}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textAlign: isFa ? 'right' : 'left' }}>
              <Avatar name={article.author.name} color={article.author.color} size={40} />
              <span>
                <a href="#author" style={{ fontWeight: 500, display: 'block' }}>
                  {article.author.name}
                </a>
                <span className={isFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                  <time dateTime={article.publishedAt}>
                    {fmtDate(article.publishedAt, isFa)}
                    {isFa ? ' UTC' : ' UTC'}
                  </time>
                  {updated && (
                    <>
                      {' '}
                      · {isFa ? 'به‌روزرسانی' : 'Updated'} <time dateTime={article.updatedAt}>{fmtTime(article.updatedAt, isFa)}</time>
                    </>
                  )}{' '}
                  · {isFa ? `${article.readingMinutes} دقیقه مطالعه` : `${article.readingMinutes} min read`}
                </span>
              </span>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <ShareButton title={article.title} url={url} />
              <Link
                href={`/chat?q=${encodeURIComponent(isFa ? `خلاصه این گزارش ویگاس را به زبان فارسی بنویس: «${article.title}»` : `Summarize this Vigas News story: "${article.title}"`)}`}
                className="ib boxed"
                aria-label={isFa ? 'پرسش از ویگاس چت درباره این خبر' : 'Ask Vigas Chat about this story'}
                title={isFa ? 'پرسش از ویگاس' : 'Ask Vigas'}
              >
                <Icon name="chat" size={17} />
              </Link>
            </span>
          </div>
        </header>

        <figure style={{ maxWidth: 1180, margin: '0 auto 48px', padding: '0 var(--vg-gutter)' }}>
          <div dir="ltr" style={{ position: 'relative', aspectRatio: '21/9', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--vg-line)', background: '#151411' }}>
            <CoverArt seed={article.slug} color={article.cover.color} category={article.category} wide />
            <span
              aria-hidden="true"
              className="sf"
              style={{ position: 'absolute', right: 'clamp(12px,3vw,28px)', bottom: 'clamp(8px,2vw,18px)', fontSize: 'clamp(36px,6vw,72px)', lineHeight: 1, color: 'var(--vg-ink)', textShadow: '0 2px 24px rgba(0,0,0,.6)' }}
            >
              {article.cover.big}
            </span>
          </div>
          <figcaption className={isFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 10 }}>
            {isFa
              ? `تصویرسازی — استودیو ویگاس · ${article.cover.big} (${article.cover.caption})`
              : `Illustration — Vigas Studio · ${article.cover.big} ${article.cover.caption.toLowerCase()}`}
          </figcaption>
        </figure>

        <div className="wrap article-layout">
          {toc.length > 1 && (
            <nav aria-label={isFa ? 'در این صفحه' : 'On this page'} className="toc article-toc">
              <div className="lbl" style={{ marginBottom: 10 }}>
                {isFa ? 'در این صفحه' : 'On this page'}
              </div>
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`}>
                  {t.text}
                </a>
              ))}
            </nav>
          )}

          <div style={{ flex: '999 1 560px', minWidth: 0, maxWidth: 680 }}>
            <div className="prose">
              {sections.map((s, i) => (
                <div key={i} className="sec">
                  <div className="sec-html" dangerouslySetInnerHTML={{ __html: s.html }} />
                  {figures(i)}
                </div>
              ))}
            </div>

            {article.faq.length > 0 && (
              <section id="faq" aria-labelledby="fq" style={{ marginTop: '2em', scrollMarginTop: 24 }}>
                <h2 id="fq" className={isFa ? 'fa-ui' : 'sf'} style={{ fontSize: isFa ? 26 : 30, margin: '0 0 8px', fontWeight: isFa ? 700 : 400 }}>
                  {isFa ? 'پرسش‌های متداول' : 'Frequently asked'}
                </h2>
                {article.faq.map((f) => (
                  <details key={f.q} style={{ borderTop: '1px solid rgba(239,234,225,.1)' }}>
                    <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '15px 0', fontWeight: 500 }}>
                      <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                      <Icon name="plus" size={18} className="pm" style={{ color: 'var(--vg-orange)' }} />
                    </summary>
                    <p style={{ margin: '0 0 16px', color: 'var(--vg-ink2)', lineHeight: isFa ? 1.85 : 1.6 }}>{f.a}</p>
                  </details>
                ))}
              </section>
            )}

            <div id="author" className="card article-author-box">
              <Avatar name={article.author.name} color={article.author.color} size={52} />
              <div>
                <b style={{ fontWeight: 600, fontSize: 16 }}>{article.author.name}</b>
                <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', margin: '2px 0 8px', textAlign: isFa ? 'right' : 'left' }}>
                  {article.author.role}
                </div>
                <p style={{ margin: 0, color: 'var(--vg-ink2)', lineHeight: isFa ? 1.8 : 1.55 }}>
                  {isFa
                    ? 'عضو تحریریه ویگاس. تمام گزارش‌ها با داده‌های زنده لیدربورد Arena و جدول تعرفه روتر ویگاس راستی‌آزمایی می‌شوند.'
                    : 'Writes for the Vigas Newsroom. Every story is checked against live data from the Vigas leaderboard and price sheet.'}
                </p>
              </div>
            </div>
          </div>

          <aside aria-label={isFa ? 'مدل‌های مرتبط با این گزارش' : 'Mentioned in this story'} style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sideModels.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h2 className="lbl" style={{ margin: '0 0 6px' }}>
                  {mentioned.length ? (isFa ? 'مدل‌های این گزارش' : 'Models in this story') : isFa ? 'مدل‌های برتر این هفته' : 'Top models right now'}
                </h2>
                {sideModels.map((m) => {
                  const mk = orgMark(m.org);
                  const rank = rankOf.get(m.id);
                  return (
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '11px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}>
                      <Mark color={mk.color} letter={mk.letter} size={32} radius={9} fontSize={16} ring={false} />
                      <span style={{ minWidth: 0 }}>
                        <Link
                          href={`/models?q=${encodeURIComponent(m.id)}`}
                          dir="ltr"
                          style={{ display: 'block', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--vg-ink)', textAlign: isFa ? 'right' : 'left' }}
                        >
                          {m.name}
                        </Link>
                        <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', textAlign: isFa ? 'right' : 'left' }}>
                          {rank ? `#${rank} · ` : ''}
                          {m.inputPerMillionMicros === 0 && m.outputPerMillionMicros === 0
                            ? 'Free'
                            : `${formatPricePerMillion(m.inputPerMillionMicros)} / ${formatPricePerMillion(m.outputPerMillionMicros)} per 1M`}
                        </span>
                      </span>
                      <Link
                        href={`/chat?model=${encodeURIComponent(m.id)}`}
                        className="btn gh"
                        style={{ minHeight: 32, padding: '0 10px', fontSize: 12, borderRadius: 8 }}
                        aria-label={isFa ? `آزمایش ${m.name} در ویگاس چت` : `Try ${m.name} in Vigas Chat`}
                      >
                        {isFa ? 'آزمایش' : 'Try'}
                      </Link>
                    </div>
                  );
                })}
                <Link href="/models" className="btn key" style={{ width: '100%', marginTop: 12 }}>
                  {isFa ? 'استفاده با یک کلید API' : 'Use them with one API key'}
                </Link>
              </div>
            )}
            <div className="card" style={{ padding: 20 }}>
              <h2 className="lbl" style={{ margin: 0 }}>
                {isFa ? 'درباره این خبر بپرسید' : 'Ask about this story'}
              </h2>
              <p style={{ margin: '8px 0 12px', fontSize: 14, color: 'var(--vg-ink2)' }}>
                {isFa ? 'این گزارش را در ویگاس چت با هر مدلی از لیدربورد تحلیل کنید.' : 'Take the question to Vigas Chat, with any model on the leaderboard.'}
              </p>
              {(isFa
                ? [
                    sideModels[0] ? `آیا ${sideModels[0].name} برای پروژه من انتخاب به‌صرفه‌ای است؟` : 'این تحول چه تاثیری روی تیم‌های فنی دارد؟',
                    showData ? 'کدام مدل در ۵ رده اول بیشترین ارزش خرید نسبت به قیمت را دارد؟' : 'این خبر را در سه نکته کلیدی خلاصه کن.',
                  ]
                : [
                    sideModels[0] ? `Is ${sideModels[0].name} worth it for my use case?` : 'What does this mean for developers?',
                    showData ? 'Which is the cheapest model in the top five?' : 'Explain this story in three bullet points.',
                  ]
              ).map((q) => (
                <Link
                  key={q}
                  href={`/chat?q=${encodeURIComponent(`${q} (${isFa ? 'متن خبر ویگاس' : 'Context: Vigas News'} — "${article.title}")`)}`}
                  style={{ display: 'block', padding: '11px 14px', borderRadius: 11, background: 'var(--vg-bg2)', border: '1px solid rgba(239,234,225,.1)', fontSize: 14, color: 'var(--vg-ink)', marginBottom: 6 }}
                >
                  {q}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section
          aria-labelledby="kr"
          dir={isFa ? 'rtl' : 'ltr'}
          className={isFa ? 'wrap fa-ui' : 'wrap'}
          style={{ maxWidth: 1180, marginTop: 56, paddingTop: 40, paddingBottom: 96, borderTop: '1px solid var(--vg-line)' }}
        >
          <div className="lbl">{isFa ? '§ بیشتر بخوانید' : '§ Keep reading'}</div>
          <h2 id="kr" className={isFa ? 'fa-ui' : 'sf'} style={{ fontSize: isFa ? 28 : 36, margin: '10px 0 24px', fontWeight: isFa ? 700 : 400 }}>
            {isFa ? (
              <>
                گزارش‌های بیشتر در{' '}
                <Link href={`/news/category/${categorySlug}?lang=fa`} style={{ color: 'var(--vg-sand)' }}>
                  {categoryLabel}
                </Link>
              </>
            ) : (
              <>
                More on{' '}
                <Link href={`/news/category/${categorySlug}`} style={{ color: 'var(--vg-sand)' }}>
                  <em className="hi">{article.category.toLowerCase()}</em>
                </Link>
              </>
            )}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 24 }}>
            {related.map((n) => {
              const nFa = n.lang === 'fa';
              return (
                <Link
                  key={n.slug}
                  href={`/news/${n.slug}`}
                  dir={nFa ? 'rtl' : 'ltr'}
                  lang={n.lang ?? 'en'}
                  className={nFa ? 'st fa-ui' : 'st'}
                  style={{ display: 'block', color: 'var(--vg-ink)' }}
                >
                  <TypoCover cover={n.cover} size="lg" style={{ aspectRatio: '16/10', marginBottom: 14, padding: '14px 16px' }} />
                  <span className={nFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, fontWeight: 600, letterSpacing: nFa ? 0 : '.1em', color: 'var(--vg-orange)' }}>
                    {nFa ? (FA_CATEGORIES[n.category] ?? n.category) : n.category.toUpperCase()}
                  </span>
                  <h3
                    className={nFa ? 'hl fa-ui' : 'sf hl'}
                    style={{ fontSize: nFa ? 19 : 23, lineHeight: nFa ? 1.45 : 1.16, margin: '6px 0 0', fontWeight: nFa ? 600 : 400 }}
                  >
                    {n.title}
                  </h3>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function WinShareFigure({ entries, isFa }: { entries: Array<{ modelId: string; name: string; winRate: number }>; isFa: boolean }) {
  const max = entries[0]?.winRate || 1;
  return (
    <figure
      id="numbers"
      style={{
        margin: '1.6em 0',
        fontFamily: isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-sans)',
        fontSize: 14,
        background: 'var(--vg-surface)',
        border: '1px solid rgba(239,234,225,.1)',
        borderRadius: 18,
        padding: '20px 22px',
        scrollMarginTop: 24,
      }}
    >
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <b style={{ fontWeight: 600, fontSize: 15, color: 'var(--vg-ink)' }}>
          {isFa ? 'سهم برد ۵ مدل برتر (رتبه‌بندی کلی)' : 'Win share, top five (overall)'}
        </b>
        <span className={isFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
          {isFa ? 'Vigas Arena · زنده' : 'Vigas Arena · live'}
        </span>
      </figcaption>
      <ol dir="ltr" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {entries.map((e, i) => (
          <li key={e.modelId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ position: 'relative', height: 34, borderRadius: 8, background: 'var(--vg-bg2)', overflow: 'hidden' }}>
              <div
                aria-hidden="true"
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((e.winRate / max) * 100).toFixed(1)}%`, background: i === 0 ? 'var(--vg-orange)' : 'var(--vg-bar)', borderRadius: 8 }}
              />
              <span
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                  padding: '0 12px',
                  color: i === 0 ? 'var(--vg-on-orange)' : 'var(--vg-ink)',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {shortName(e.name)}
              </span>
            </div>
            <span className="mn" dir="ltr" style={{ textAlign: 'right', fontSize: 13, color: 'var(--vg-green)' }}>
              {e.winRate.toFixed(2)}%
            </span>
          </li>
        ))}
      </ol>
      <Link href="/leaderboard" style={{ display: 'inline-block', marginTop: 10, color: 'var(--vg-indigo)', fontWeight: 500, textDecoration: 'none' }}>
        {isFa ? 'مشاهده جدول رده‌بندی زنده ←' : 'See the live leaderboard →'}
      </Link>
    </figure>
  );
}

function PullQuote({ quote, isFa }: { quote: { text: string; cite: string }; isFa: boolean }) {
  return (
    <blockquote className="pull-quote" style={isFa ? { fontStyle: 'normal', fontSize: 'clamp(19px,2.4vw,26px)', lineHeight: 1.65 } : undefined}>
      <p style={{ margin: 0 }}>{isFa ? `«${quote.text}»` : `“${quote.text}”`}</p>
      <cite
        className={isFa ? 'fa-ui' : 'mn'}
        style={{
          display: 'block',
          fontSize: 12,
          color: 'var(--vg-ink3)',
          fontStyle: 'normal',
          marginTop: 12,
          letterSpacing: isFa ? 0 : '.08em',
          textTransform: isFa ? 'none' : 'uppercase',
        }}
      >
        — {quote.cite}
      </cite>
    </blockquote>
  );
}

function KeyNumbers({ article, topShare, modelCount, isFa }: { article: Article; topShare: number | null; modelCount: number; isFa: boolean }) {
  const items: Array<[string, string]> = isFa
    ? [[article.cover.big, `${article.cover.caption} — شاخص اصلی این گزارش`]]
    : [[article.cover.big, `${article.cover.caption.toLowerCase()} — the headline figure of this story`]];
  if (topShare !== null) {
    items.push([`${topShare.toFixed(2)}%`, isFa ? 'بالاترین سهم برد در جدول کلی ویگاس' : 'top win share on the overall Vigas board right now']);
  }
  items.push([String(modelCount), isFa ? 'مدل فعال در روتر و API یکپارچه ویگاس' : 'models available on the Vigas router']);
  return (
    <aside
      aria-label={isFa ? 'اعداد کلیدی' : 'Key numbers'}
      style={{
        margin: '1.6em 0',
        fontFamily: isFa ? 'var(--vg-font-fa)' : 'var(--vg-font-sans)',
        fontSize: 14,
        border: '1px solid var(--vg-line2)',
        borderRadius: 16,
        padding: '18px 22px',
        background: 'var(--vg-bg2)',
      }}
    >
      <b style={{ fontWeight: 600, color: 'var(--vg-ink)' }}>{isFa ? 'اعداد کلیدی' : 'Key numbers'}</b>
      <ul
        style={{
          margin: '10px 0 0',
          paddingLeft: isFa ? 0 : 18,
          paddingRight: isFa ? 18 : 0,
          color: 'var(--vg-ink2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {items.map(([n, t]) => (
          <li key={t} style={{ margin: 0 }}>
            <span className="mn" dir="ltr" style={{ color: 'var(--vg-ink)' }}>
              {n}
            </span>{' '}
            — {t}
          </li>
        ))}
      </ul>
    </aside>
  );
}
