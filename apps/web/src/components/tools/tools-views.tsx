import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { TOOL_CATEGORIES, type ToolCategory, type ToolItem } from '@vigas/core';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ToolsDirectory } from '@/components/tools/tools-directory';
import { ToolVote } from '@/components/tools/vote-button';
import { Breadcrumb, Icon, JsonLd, ToolMark } from '@/components/ui';
import { getToolBySlug, getTools } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { toolImageUrl } from '@/lib/media';
import { breadcrumbLd, faqLd } from '@/lib/seo';
import {
  getToolDetailFaq,
  getToolsDirectoryFaq,
  NEWS_CATEGORY_LABELS_FA,
  TOOL_CATEGORY_LABELS_FA,
  TOOL_CATEGORY_SEO,
  TOOL_CATEGORY_SEO_FA,
  TOOL_COLLECTIONS,
  TOOL_COLLECTIONS_FA,
  type ToolCollectionSlug,
} from '@/lib/seo-catalog';

const APP_CATEGORY: Record<string, string> = {
  Agents: 'DeveloperApplication',
  Coding: 'DeveloperApplication',
  Research: 'ReferenceApplication',
  Image: 'MultimediaApplication',
  Video: 'MultimediaApplication',
  Audio: 'MultimediaApplication',
  Productivity: 'BusinessApplication',
};

const PRICING_FA: Record<string, string> = {
  Free: 'رایگان',
  Freemium: 'فریمیوم',
  Paid: 'پولی',
};

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function LangShell({ lang, children }: { lang: 'en' | 'fa'; children: ReactNode }) {
  if (lang === 'fa') {
    return (
      <div dir="rtl" lang="fa" className="fa-ui">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}

export async function ToolsIndexView({ lang = 'en' }: { lang?: 'en' | 'fa' } = {}) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');

  const isFa = lang === 'fa';
  const tools = await getTools({ sort: 'votes' });
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const toolsLabel = isFa ? 'ابزارها' : 'Tools';

  const collections: Array<{ t: string; href: string; items: ToolItem[] }> = (
    isFa
      ? [
          { t: 'بهترین ابزارهای کدنویسی AI در ۲۰۲۶', href: '/tools/category/coding', items: tools.filter((t) => t.category === 'Coding') },
          { t: 'بهترین مولدهای تصویر هوش مصنوعی', href: '/tools/category/image', items: tools.filter((t) => t.category === 'Image') },
          { t: 'ابزارهای رایگان و کاربردی AI', href: '/tools/collection/free', items: tools.filter((t) => t.pricing !== 'Paid') },
          { t: 'بهترین ابزارهای صدا و موسیقی', href: '/tools/category/audio', items: tools.filter((t) => t.category === 'Audio') },
          { t: 'دستیارهای پژوهش و جستجو', href: '/tools/category/research', items: tools.filter((t) => t.category === 'Research') },
          { t: 'اپ‌های متصل به Vigas API', href: '/tools/collection/vigas-api', items: tools.filter((t) => t.runsOnVigas) },
        ]
      : [
          { t: 'Best AI coding tools in 2026', href: '/tools/category/coding', items: tools.filter((t) => t.category === 'Coding') },
          { t: 'Best AI image generators', href: '/tools/category/image', items: tools.filter((t) => t.category === 'Image') },
          { t: 'Free AI tools worth using', href: '/tools/collection/free', items: tools.filter((t) => t.pricing !== 'Paid') },
          { t: 'Best AI voice & music tools', href: '/tools/category/audio', items: tools.filter((t) => t.category === 'Audio') },
          { t: 'AI research assistants', href: '/tools/category/research', items: tools.filter((t) => t.category === 'Research') },
          { t: 'Apps running on Vigas API', href: '/tools/collection/vigas-api', items: tools.filter((t) => t.runsOnVigas) },
        ]
  ).filter((c) => c.items.length > 0);
  const faqItems = getToolsDirectoryFaq(tools, lang);

  return (
    <LangShell lang={lang}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: homeLabel, path: homeHref },
            { name: toolsLabel, path: '/tools' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: isFa ? 'بهترین ابزارهای هوش مصنوعی ۲۰۲۶' : 'Best AI tools of 2026',
            inLanguage: lang,
            description: isFa
              ? 'فهرست دست‌چین ابزارهای کدنویسی، پژوهش، تصویر، ویدیو، صوت و ایجنت‌های هوش مصنوعی با رأی توسعه‌دهندگان در ویگاس.'
              : 'Curated directory of AI coding, research, image, video, audio, and agent apps ranked by builder upvotes on Vigas.',
            url: absoluteUrl('/tools'),
            mainEntity: {
              '@type': 'ItemList',
              name: isFa ? 'دایرکتوری ابزارهای AI' : 'AI tools directory',
              numberOfItems: tools.length,
              itemListElement: tools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          faqLd(faqItems),
        ]}
      />
      <SiteHeader active="tools" lang={lang} />
      <main id="main" className="wrap">
        <Breadcrumb lang={lang} items={[{ name: homeLabel, href: homeHref }, { name: toolsLabel }]} style={{ paddingTop: 18 }} />
        <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(28px,3.2vw,40px)' : 'clamp(30px,3.6vw,44px)',
                lineHeight: isFa ? 1.15 : 1,
                letterSpacing: isFa ? 0 : '-.025em',
                fontWeight: isFa ? 700 : 400,
                margin: 0,
              }}
            >
              {isFa ? (
                <>
                  دایرکتوری <em className="hi">ابزارهای AI</em>
                </>
              ) : (
                <>
                  AI <em className="hi">tools</em>
                </>
              )}
            </h1>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {isFa ? `${tools.length} ابزار تأییدشده · رتبه‌بندی با رأی کاربران` : `${tools.length} verified apps · ranked by builders`}
            </span>
          </div>
          <a href="#submit" className="btn gh" style={{ minHeight: 40, padding: '0 16px', fontSize: 13.5 }}>
            <Icon name="plus" size={15} />
            {isFa ? 'ثبت ابزار جدید' : 'Submit app'}
          </a>
        </header>

        {/* Ranked this week strip (matches vigas-design-2026 DTools) */}
        {tools.length >= 4 && (
          <section
            aria-label={isFa ? 'برترین‌های هفته' : 'Ranked this week'}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
              gap: 14,
              marginBottom: 26,
            }}
          >
            <Link
              href={`/tools/${tools[0]!.slug}`}
              className="bg-signal-grad lift"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 22,
                padding: '22px 24px',
                color: '#fff',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 24px 60px -22px rgba(255, 90, 31, .45)',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  insetInlineEnd: -36,
                  top: -36,
                  width: 150,
                  height: 150,
                  borderRadius: '50%',
                  border: '18px solid rgba(255,255,255,.15)',
                }}
              />
              <div className="mn" style={{ position: 'relative', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.16em', color: 'rgba(255,255,255,.78)' }}>
                {isFa ? 'این هفته · رتبه ۱' : 'This week · #1'}
              </div>
              <div
                className={isFa ? 'fa-ui' : 'sf'}
                style={{ position: 'relative', fontSize: isFa ? 24 : 30, lineHeight: isFa ? 1.3 : 1.05, fontWeight: isFa ? 800 : 400, marginTop: 10, color: '#fff' }}
              >
                {isFa ? `${tools[0]!.name} صدرنشین شد` : `${tools[0]!.name} tops the directory`}
              </div>
              <div className="mn" dir="ltr" style={{ position: 'relative', marginTop: 10, fontSize: 12.5, color: 'rgba(255,255,255,.85)', textAlign: 'start' }}>
                ▲ {tools[0]!.votes.toLocaleString('en-US')} · ★ {tools[0]!.rating.toFixed(1)}
              </div>
            </Link>

            {tools.slice(1, 4).map((tl, idx) => (
              <Link
                key={tl.slug}
                href={`/tools/${tl.slug}`}
                className="lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderRadius: 22,
                  border: '1px solid var(--vg-line)',
                  background: 'var(--vg-surface)',
                  padding: '18px 20px',
                  color: 'var(--vg-ink)',
                  textDecoration: 'none',
                }}
              >
                <span className="sf" dir="ltr" style={{ fontSize: 38, lineHeight: 1, color: 'var(--vg-sand)', flexShrink: 0 }}>
                  {['II', 'III', 'IV'][idx]}
                </span>
                <ToolMark slug={tl.slug} iconUrl={tl.iconUrl} color={tl.color} letter={tl.letter} size={42} radius={12} fontSize={18} />
                <div style={{ minWidth: 0 }}>
                  <div dir="ltr" style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: isFa ? 'right' : 'left' }}>
                    {tl.name}
                  </div>
                  <div className="mn" dir="ltr" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginTop: 2, textAlign: isFa ? 'right' : 'left' }}>
                    ▲ {tl.votes.toLocaleString('en-US')} · ★ {tl.rating.toFixed(1)}
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}

        <section id="dir" aria-label={isFa ? 'دایرکتوری ابزارهای هوش مصنوعی' : 'AI tools directory'} style={{ paddingBottom: 56, scrollMarginTop: 24 }}>
          <ToolsDirectory tools={tools} categories={TOOL_CATEGORIES} lang={lang} />
        </section>

        <section aria-labelledby="col" style={{ padding: '44px 0 48px', borderTop: '1px solid var(--vg-line)' }}>
          <div className="lbl">{isFa ? '§ کلکسیون‌ها و راهنماها' : '§ Collections & guides'}</div>
          <h2
            id="col"
            className="sf"
            style={{
              fontSize: isFa ? 'clamp(26px,2.8vw,34px)' : 'clamp(28px,3vw,38px)',
              margin: '8px 0 18px',
              letterSpacing: isFa ? 0 : '-.02em',
              lineHeight: isFa ? 1.2 : 1.04,
              fontWeight: isFa ? 700 : 400,
            }}
          >
            {isFa ? (
              <>
                مرور بر اساس <em className="hi">کاربرد و جریان کار.</em>
              </>
            ) : (
              <>
                Browse by <em className="hi">workflow.</em>
              </>
            )}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(270px,100%),1fr))', gap: 12 }}>
            {collections.map((c) => (
              <Link key={c.t} href={c.href} className="lift card" style={{ display: 'flex', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, color: 'var(--vg-ink)' }}>
                <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
                  {c.items.slice(0, 3).map((s) => (
                    <ToolMark
                      key={s.slug}
                      slug={s.slug}
                      iconUrl={s.iconUrl}
                      color={s.color}
                      letter={s.letter}
                      size={30}
                      radius={9}
                      fontSize={14}
                      style={{ marginInlineEnd: -6, borderWidth: 2, borderColor: 'var(--vg-surface)' }}
                    />
                  ))}
                </span>
                <span style={{ minWidth: 0, marginInlineStart: 6 }}>
                  <b style={{ display: 'block', fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>
                    {c.t}
                  </b>
                  <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {isFa ? `${c.items.length} ابزار` : `${c.items.length} ${c.items.length === 1 ? 'app' : 'apps'}`}
                  </span>
                </span>
                <Icon name="chevRight" size={16} style={{ marginInlineStart: 'auto', color: 'var(--vg-ink3)', transform: isFa ? 'scaleX(-1)' : undefined }} />
              </Link>
            ))}
          </div>
          <nav aria-label={isFa ? 'مرور ابزارها بر اساس دسته' : 'Browse tools by category'} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {TOOL_CATEGORIES.map((c) => (
              <Link key={c} href={`/tools/category/${c.toLowerCase()}`} className="tag">
                {isFa ? `ابزارهای ${TOOL_CATEGORY_LABELS_FA[c]}` : `${c} tools`}
              </Link>
            ))}
            <Link href="/tools/collection/free" className="tag">
              {isFa ? 'ابزارهای رایگان AI' : 'Free AI tools'}
            </Link>
            <Link href="/tools/collection/vigas-api" className="tag">
              {isFa ? 'اپ‌های Vigas API' : 'Vigas API apps'}
            </Link>
            <Link href="/tools/collection/new" className="tag">
              {isFa ? 'معرفی‌های تازه' : 'New launches'}
            </Link>
          </nav>
        </section>

        <section aria-labelledby="tools-faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '40px 0 56px', borderTop: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div className="lbl">{isFa ? '§ درباره این دایرکتوری' : '§ About this directory'}</div>
            <h2
              id="tools-faq"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(26px,2.8vw,36px)' : 'clamp(28px,3vw,40px)',
                lineHeight: isFa ? 1.2 : 1.04,
                margin: '8px 0 10px',
                letterSpacing: isFa ? 0 : '-.02em',
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {isFa ? (
                <>
                  پرسش‌های <em className="hi">دایرکتوری ابزارها.</em>
                </>
              ) : (
                <>
                  Curated <em className="hi">AI apps FAQ.</em>
                </>
              )}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)', maxWidth: 380, lineHeight: isFa ? 1.75 : undefined }}>
              {isFa
                ? 'تمامی ابزارها به‌صورت دستی توسط تحریریه ویگاس بررسی شده و با قیمت‌گذاری شفاف و آرای واقعی جامعه رتبه‌بندی می‌شوند.'
                : 'Every application is manually reviewed by Vigas editors, tagged with verified pricing, and sorted by real community upvotes.'}
            </p>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {faqItems.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.8 : undefined }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="submit"
          aria-labelledby="submit-title"
          style={{
            marginBottom: 96,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'clamp(22px,3vw,40px)',
            borderRadius: 24,
            background: 'var(--vg-orange)',
            color: 'var(--vg-on-orange)',
            scrollMarginTop: 24,
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <h2
              id="submit-title"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(26px,3vw,38px)' : 'clamp(32px,3.4vw,46px)',
                margin: 0,
                lineHeight: isFa ? 1.22 : 1.04,
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {isFa ? 'ابزار هوش مصنوعی جدیدی ساخته‌اید؟' : 'Built something people should know about?'}
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 16, maxWidth: 560 }}>
              {isFa
                ? 'محصول خود را ثبت کنید. تحریریه ما همه ابزارها را آزمایش می‌کند و برترین‌ها در خبرنامه هفتگی معرفی می‌شوند.'
                : 'Submit your tool. Our editors test every submission, and the best ones make the weekly newsletter.'}
            </p>
          </div>
          <a href="mailto:tools@vigas.ai?subject=Tool%20submission" className="btn dark-btn" style={{ minHeight: 52, padding: '0 26px', fontSize: 15 }}>
            {isFa ? 'ارسال ابزار' : 'Submit a tool'}
          </a>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </LangShell>
  );
}

export async function ToolDetailPageView({ slug, lang = 'en' }: { slug: string; lang?: 'en' | 'fa' }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools', `tool:${slug}`);

  const isFa = lang === 'fa';
  const [tool, all] = await Promise.all([getToolBySlug(slug), getTools({ sort: 'votes' })]);
  if (!tool) notFound();
  const categorySlug = tool.category.toLowerCase();
  const catDisplay = isFa ? (TOOL_CATEGORY_LABELS_FA[tool.category] ?? tool.category) : tool.category;
  const pricingDisplay = isFa ? (PRICING_FA[tool.pricing] ?? tool.pricing) : tool.pricing;
  const rank = all.findIndex((t) => t.slug === tool.slug) + 1;
  const categoryTools = all.filter((t) => t.category === tool.category);
  const categoryRank = categoryTools.findIndex((t) => t.slug === tool.slug) + 1;
  const similar = [...categoryTools.filter((t) => t.slug !== tool.slug), ...all.filter((t) => t.category !== tool.category)].slice(0, 3);
  const compared = [tool, ...similar];
  const faqItems = getToolDetailFaq(tool, all, rank, categoryRank, lang);
  const previewUrl = toolImageUrl(tool.slug, tool.imageUrl);
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const toolsLabel = isFa ? 'ابزارها' : 'Tools';

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: tool.name,
      description: tool.description,
      applicationCategory: APP_CATEGORY[tool.category] ?? 'WebApplication',
      operatingSystem: 'Web',
      url: tool.url,
      image: previewUrl ? [absoluteUrl(previewUrl), absoluteUrl(`/og/tool/${tool.slug}`)] : [absoluteUrl(`/og/tool/${tool.slug}`)],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        description: tool.pricing,
        url: tool.url,
      },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: tool.rating.toFixed(1), bestRating: '5', worstRating: '1', ratingCount: tool.votes },
    },
    breadcrumbLd([
      { name: homeLabel, path: homeHref },
      { name: toolsLabel, path: '/tools' },
      { name: catDisplay, path: `/tools/category/${categorySlug}` },
      { name: tool.name, path: `/tools/${tool.slug}` },
    ]),
    faqLd(faqItems),
  ];

  const facts: Array<{ key: string; label: string; value: string; ltr?: boolean }> = isFa
    ? [
        { key: 'Category', label: 'دسته‌بندی', value: catDisplay },
        { key: 'Pricing', label: 'مدل قیمت', value: pricingDisplay },
        { key: 'Rating', label: 'امتیاز', value: `★ ${tool.rating.toFixed(1)} / 5`, ltr: true },
        { key: 'Upvotes', label: 'تعداد آرا', value: tool.votes.toLocaleString('en-US'), ltr: true },
        { key: 'Rank', label: 'رتبه در ویگاس', value: `#${rank} کل · #${categoryRank} در ${catDisplay}` },
        { key: 'Website', label: 'وب‌سایت', value: host(tool.url), ltr: true },
      ]
    : [
        { key: 'Category', label: 'Category', value: tool.category },
        { key: 'Pricing', label: 'Pricing', value: tool.pricing },
        { key: 'Rating', label: 'Rating', value: `★ ${tool.rating.toFixed(1)} / 5`, ltr: true },
        { key: 'Upvotes', label: 'Upvotes', value: tool.votes.toLocaleString('en-US'), ltr: true },
        { key: 'Rank', label: 'Rank', value: `#${rank} overall · #${categoryRank} in ${tool.category}` },
        { key: 'Website', label: 'Website', value: host(tool.url), ltr: true },
      ];

  return (
    <LangShell lang={lang}>
      <JsonLd data={ld} />
      <SiteHeader active="tools" lang={lang} />
      <main id="main" className="wrap">
        <Breadcrumb
          lang={lang}
          items={[
            { name: homeLabel, href: homeHref },
            { name: toolsLabel, href: '/tools' },
            { name: catDisplay, href: `/tools/category/${categorySlug}` },
            { name: tool.name },
          ]}
          style={{ paddingTop: 22 }}
        />

        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 36, padding: '22px 0 48px', alignItems: 'flex-start', borderBottom: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1.4 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <ToolMark slug={tool.slug} iconUrl={tool.iconUrl} color={tool.color} letter={tool.letter} size={76} radius={20} fontSize={36} />
              <div style={{ minWidth: 0 }}>
                <div className="lbl" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/tools/category/${categorySlug}`} style={{ color: 'var(--vg-ink3)' }}>
                    {catDisplay}
                  </Link>
                  {' · '}
                  {pricingDisplay}
                  {tool.isNew && <span style={{ color: 'var(--vg-sand)' }}>· {isFa ? 'جدید' : 'New'}</span>}
                </div>
                <h1 className="sf" dir="ltr" style={{ fontSize: 'clamp(40px,5.2vw,68px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '8px 0 0', textAlign: isFa ? 'right' : 'left' }}>
                  {tool.name}
                </h1>
              </div>
            </div>
            <p className="sf" dir="ltr" style={{ fontSize: 'clamp(20px,2vw,26px)', lineHeight: 1.3, color: 'var(--vg-ink)', margin: 0, maxWidth: 680, textAlign: isFa ? 'right' : 'left' }}>
              <em className="hi">{tool.tagline}</em>
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href={tool.url} className="btn key" target="_blank" rel="noopener noreferrer" style={{ minHeight: 48, padding: '0 22px', fontSize: 15 }}>
                {isFa ? (
                  <>
                    مشاهده <bdi dir="ltr">{host(tool.url)}</bdi>
                  </>
                ) : (
                  <>Visit {host(tool.url)}</>
                )}
                <Icon name="external" size={16} />
                <span className="sr-only">{isFa ? '(در تب جدید باز می‌شود)' : '(opens in a new tab)'}</span>
              </a>
              <ToolVote slug={tool.slug} name={tool.name} votes={tool.votes} lang={lang} />
            </div>
            {tool.highlights && tool.highlights.length > 0 && (
              <ul dir="ltr" style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: isFa ? 'flex-end' : undefined }}>
                {tool.highlights.map((h) => (
                  <li key={h} className="pill" style={{ background: 'var(--vg-surface)', border: '1px solid var(--vg-line)', padding: '6px 11px', color: 'var(--vg-ink2)', fontFamily: 'var(--vg-font-sans)' }}>
                    ✓ {h}
                  </li>
                ))}
              </ul>
            )}
            <p dir="ltr" style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--vg-ink2)', margin: 0, maxWidth: 640, textAlign: isFa ? 'right' : 'left' }}>
              {tool.description}
            </p>
          </div>

          <aside aria-label={isFa ? 'پیش‌نمایش و جزئیات ابزار' : 'App preview and details'} style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {previewUrl && (
              <div style={{ overflow: 'hidden', borderRadius: 24, border: '1px solid var(--vg-line2)', background: 'var(--vg-surface)', boxShadow: '0 32px 80px -32px rgba(0,0,0,.6)' }}>
                <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderBottom: '1px solid var(--vg-line)', background: 'var(--vg-bg2)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
                  <span className="mn" style={{ margin: '0 auto', fontSize: 11, color: 'var(--vg-ink3)' }}>{tool.slug}</span>
                </div>
                <img src={previewUrl} alt={`${tool.name} — ${tool.category} application interface preview`} width={640} height={360} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            )}
            <div className="card" style={{ borderRadius: 24, padding: 22 }}>
              <h2 className="lbl" style={{ margin: '0 0 6px' }}>
                {isFa ? 'در یک نگاه' : 'At a glance'}
              </h2>
              <dl style={{ margin: 0 }}>
                {facts.map((f) => (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid var(--vg-line)', fontSize: 14 }}>
                    <dt style={{ color: 'var(--vg-ink3)' }}>{f.label}</dt>
                    <dd className="mn" dir={f.ltr ? 'ltr' : undefined} style={{ margin: 0, textAlign: 'end', fontSize: 13 }}>
                      {f.key === 'Category' ? (
                        <Link href={`/tools/category/${categorySlug}`} style={{ color: 'var(--vg-sand)' }}>
                          {f.value}
                        </Link>
                      ) : (
                        f.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {tool.runsOnVigas && (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: 'var(--vg-orange-soft)', border: '1px solid var(--vg-orange-edge)', display: 'flex', gap: 10 }}>
                  <Icon name="verified" size={18} style={{ color: 'var(--vg-orange-text)', marginTop: 2, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--vg-ink2)' }}>
                    {isFa ? (
                      <>
                        <b style={{ color: 'var(--vg-ink)', fontWeight: 600 }}>روی API ویگاس اجرا می‌شود.</b> با کلید و اعتبار ویگاس — بدون اشتراک جداگانه مدل.
                      </>
                    ) : (
                      <>
                        <b style={{ color: 'var(--vg-ink)', fontWeight: 600 }}>Runs on the Vigas API.</b> Use your Vigas key and credits — no separate model subscription.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </section>

        <section aria-labelledby="why" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 18, padding: '52px 0' }}>
          <h2 id="why" className="sr-only">
            {isFa ? `چرا سازندگان ${tool.name} را انتخاب می‌کنند` : `Why builders pick ${tool.name}`}
          </h2>
          {(isFa
            ? [
                ['var(--vg-orange)', 'کارکرد اصلی', tool.tagline, true],
                [
                  'var(--vg-sand)',
                  'مناسب برای چه کسانی',
                  `تیم‌ها و توسعه‌دهندگانی که به دنبال ابزار ${catDisplay} ${tool.pricing === 'Free' ? 'کاملاً رایگان' : tool.pricing === 'Freemium' ? 'با پلن شروع رایگان' : 'حرفه‌ای و پولی'} هستند.`,
                  false,
                ],
                [
                  'var(--vg-ink3)',
                  'جایگاه در ویگاس',
                  `رتبه #${categoryRank} از ${categoryTools.length} در دسته ${catDisplay} و رتبه #${rank} از ${all.length} در کل، با رأی توسعه‌دهندگان ویگاس.`,
                  false,
                ],
              ]
            : [
                ['var(--vg-orange)', 'What it does', tool.tagline, false],
                ['var(--vg-sand)', 'Who it’s for', `Builders and teams looking for a ${tool.category.toLowerCase()} tool${tool.pricing === 'Free' ? ' that costs nothing to start' : tool.pricing === 'Freemium' ? ' with a free tier to try first' : ' worth paying for'}.`, false],
                ['var(--vg-ink3)', 'How it ranks', `#${categoryRank} of ${categoryTools.length} in ${tool.category} and #${rank} of ${all.length} overall, by builder upvotes on Vigas.`, false],
              ] as Array<[string, string, string, boolean]>
          ).map(([c, t, d, isLtrBody]) => (
            <div key={String(t)} style={{ borderTop: `2px solid ${String(c)}`, paddingTop: 18 }}>
              <h3 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: '0 0 6px', fontWeight: isFa ? 600 : 400 }}>
                {t}
              </h3>
              <p dir={isLtrBody ? 'ltr' : undefined} style={{ margin: 0, color: 'var(--vg-ink2)', textAlign: isFa && isLtrBody ? 'right' : undefined, lineHeight: isFa ? 1.75 : undefined }}>
                {d}
              </p>
            </div>
          ))}
        </section>

        {/* Set up in 30 seconds · Connect to Vigas (matches vigas-design-2026 DToolDetail) */}
        {tool.runsOnVigas && (
          <section
            style={{
              marginBottom: 56,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 'clamp(22px, 4vw, 44px)',
              alignItems: 'center',
              borderRadius: 28,
              border: '1px solid var(--vg-line)',
              background: 'var(--vg-surface)',
              padding: 'clamp(22px, 3.6vw, 40px)',
            }}
          >
            <div>
              <div className="lbl" style={{ color: 'var(--vg-orange-text)' }}>
                {isFa ? '§ راه‌اندازی در ۳۰ ثانیه' : '§ Set up in 30 seconds'}
              </div>
              <h2 className="sf" style={{ fontSize: isFa ? 'clamp(26px,3.2vw,38px)' : 'clamp(32px,3.6vw,44px)', margin: '10px 0 18px', lineHeight: isFa ? 1.25 : 1.05, fontWeight: isFa ? 700 : 400 }}>
                {isFa ? (
                  <>
                    اتصال {tool.name} به <span className="text-signal">ویگاس</span>
                  </>
                ) : (
                  <>
                    Connect {tool.name} to <span className="text-signal">Vigas</span>
                  </>
                )}
              </h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15, color: 'var(--vg-ink2)' }}>
                {(isFa
                  ? [
                      `وارد تنظیمات ${tool.name} → بخش API Provider شوید`,
                      'گزینه «OpenAI Compatible» را انتخاب کنید',
                      'آدرس پایه و کلید API ویگاس خود را وارد کنید',
                    ]
                  : [
                      `Open ${tool.name} → Settings → API Provider`,
                      'Choose “OpenAI Compatible”',
                      'Paste the Vigas Base URL and your API key',
                    ]
                ).map((step, idx) => (
                  <li key={step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="mn" style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div dir="ltr" className="mn" style={{ borderRadius: 20, background: '#070708', border: '1px solid var(--vg-line2)', padding: 22, fontSize: 13, lineHeight: 2, color: 'rgba(255,255,255,.85)' }}>
              <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11.5 }}>Base URL</div>
              <div style={{ color: '#3EE39B' }}>https://api.vigas.ai/v1</div>
              <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11.5, marginTop: 8 }}>API Key</div>
              <div style={{ color: '#3EE39B' }}>sk-vg-v1-••••••••</div>
              <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11.5, marginTop: 8 }}>Model</div>
              <div>google/gemini-4-hydrogen</div>
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <>
            <section aria-labelledby="cmp" style={{ paddingBottom: 56 }}>
              <div className="lbl">{isFa ? '§ مقایسه در یک نگاه' : '§ Side by side'}</div>
              <h2
                id="cmp"
                className="sf"
                style={{
                  fontSize: isFa ? 'clamp(26px,2.8vw,38px)' : 'clamp(30px,3.2vw,42px)',
                  margin: '10px 0 20px',
                  letterSpacing: isFa ? 0 : '-.02em',
                  lineHeight: isFa ? 1.2 : 1.04,
                  fontWeight: isFa ? 700 : 400,
                }}
              >
                {isFa ? (
                  <>
                    مقایسه {tool.name} با جایگزین‌های <em className="hi">{catDisplay}</em>
                  </>
                ) : (
                  <>
                    Compare {tool.name} with <em className="hi">{tool.category.toLowerCase()}</em> alternatives
                  </>
                )}
              </h2>
              <div className="card" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <div className="rt-desktop tablewrap">
                  <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                    <caption className="sr-only">
                      {isFa ? `مقایسه ${tool.name} و ابزارهای مشابه ${catDisplay}` : `Comparison between ${tool.name} and ${tool.category} alternatives`}
                    </caption>
                    <thead>
                      <tr className="mn" style={{ background: 'var(--vg-bg2)', fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                        <th scope="col" style={{ padding: '12px 18px', textAlign: 'start', fontWeight: 500 }}>
                          {isFa ? 'ابزار' : 'Tool'}
                        </th>
                        <th scope="col" style={{ padding: '12px 18px', textAlign: 'start', fontWeight: 500 }}>
                          {isFa ? 'مدل قیمت' : 'Pricing'}
                        </th>
                        <th scope="col" style={{ padding: '12px 18px', textAlign: 'end', fontWeight: 500 }}>
                          {isFa ? 'امتیاز سازندگان' : 'Builder rating'}
                        </th>
                        <th scope="col" style={{ padding: '12px 18px', textAlign: 'end', fontWeight: 500 }}>
                          {isFa ? 'تعداد آرا' : 'Upvotes'}
                        </th>
                        <th scope="col" style={{ padding: '12px 18px', textAlign: 'end', fontWeight: 500 }}>
                          Vigas API
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {compared.map((item) => {
                        const current = item.slug === tool.slug;
                        return (
                          <tr key={item.slug} className="hov" style={{ borderTop: '1px solid var(--vg-line-soft)', background: current ? 'var(--vg-orange-soft)' : undefined }}>
                            <th scope="row" style={{ padding: '13px 18px', textAlign: 'start', fontWeight: 500 }}>
                              {current ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                  <ToolMark slug={item.slug} iconUrl={item.iconUrl} color={item.color} letter={item.letter} size={28} radius={8} fontSize={14} />
                                  <span>
                                    <bdi dir="ltr">{item.name}</bdi>{' '}
                                    <span className="pill" style={{ marginInlineStart: 6 }}>
                                      {isFa ? 'فعلی' : 'Current'}
                                    </span>
                                  </span>
                                </span>
                              ) : (
                                <Link href={`/tools/${item.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--vg-ink)' }}>
                                  <ToolMark slug={item.slug} iconUrl={item.iconUrl} color={item.color} letter={item.letter} size={28} radius={8} fontSize={14} />
                                  <bdi dir="ltr">{item.name}</bdi>
                                </Link>
                              )}
                            </th>
                            <td className="mn" style={{ padding: '13px 18px', fontSize: 13, color: item.pricing === 'Free' ? 'var(--vg-green)' : 'var(--vg-ink2)' }}>
                              {isFa ? (PRICING_FA[item.pricing] ?? item.pricing) : item.pricing}
                            </td>
                            <td className="mn" dir="ltr" style={{ padding: '13px 18px', textAlign: 'end', fontSize: 13, color: 'var(--vg-sand)' }}>
                              ★ {item.rating.toFixed(1)}
                            </td>
                            <td className="mn" dir="ltr" style={{ padding: '13px 18px', textAlign: 'end', fontSize: 13 }}>
                              ▲ {item.votes.toLocaleString('en-US')}
                            </td>
                            <td className="mn" style={{ padding: '13px 18px', textAlign: 'end', fontSize: 12 }}>
                              {item.runsOnVigas ? <span style={{ color: 'var(--vg-orange-text)' }}>{isFa ? 'پشتیبانی‌شده' : 'Supported'}</span> : <span style={{ color: 'var(--vg-ink3)' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rt-mobile">
                  {compared.map((item, idx) => {
                    const current = item.slug === tool.slug;
                    return (
                      <div key={item.slug} style={{ padding: '14px 16px', borderTop: idx ? '1px solid var(--vg-line-soft)' : undefined, background: current ? 'var(--vg-orange-soft)' : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ToolMark slug={item.slug} iconUrl={item.iconUrl} color={item.color} letter={item.letter} size={30} radius={9} fontSize={15} />
                          {current ? (
                            <b style={{ fontWeight: 600 }}>
                              <bdi dir="ltr">{item.name}</bdi>{' '}
                              <span className="pill" style={{ marginInlineStart: 4 }}>
                                {isFa ? 'فعلی' : 'Current'}
                              </span>
                            </b>
                          ) : (
                            <Link href={`/tools/${item.slug}`} style={{ fontWeight: 600, color: 'var(--vg-ink)' }}>
                              <bdi dir="ltr">{item.name}</bdi>
                            </Link>
                          )}
                          <span className="mn" dir="ltr" style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--vg-sand)' }}>
                            ★ {item.rating.toFixed(1)}
                          </span>
                        </div>
                        <div className="mn" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--vg-ink2)' }}>
                          <span>{isFa ? (PRICING_FA[item.pricing] ?? item.pricing) : item.pricing}</span>
                          <span dir="ltr">▲ {item.votes.toLocaleString('en-US')} {isFa ? 'رأی' : 'upvotes'}</span>
                          <span>{item.runsOnVigas ? 'Vigas API' : isFa ? (TOOL_CATEGORY_LABELS_FA[item.category] ?? item.category) : item.category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section aria-labelledby="similar" style={{ paddingBottom: 64 }}>
              <div className="lbl">{isFa ? '§ ابزارهای جایگزین' : '§ Alternatives'}</div>
              <h2
                id="similar"
                className="sf"
                style={{
                  fontSize: isFa ? 'clamp(28px,3vw,40px)' : 'clamp(32px,3.4vw,46px)',
                  margin: '10px 0 22px',
                  letterSpacing: isFa ? 0 : '-.02em',
                  lineHeight: isFa ? 1.2 : 1.04,
                  fontWeight: isFa ? 700 : 400,
                }}
              >
                {isFa ? (
                  <>
                    ابزارهای بیشتر در دسته <em className="hi">{catDisplay}</em>
                  </>
                ) : (
                  <>
                    More <em className="hi">{tool.category.toLowerCase()}</em> tools
                  </>
                )}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 14 }}>
                {similar.map((t) => (
                  <Link key={t.slug} href={`/tools/${t.slug}`} className="lift card" style={{ borderRadius: 18, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start', color: 'var(--vg-ink)' }}>
                    <ToolMark slug={t.slug} iconUrl={t.iconUrl} color={t.color} letter={t.letter} size={48} radius={13} fontSize={21} />
                    <span style={{ minWidth: 0 }}>
                      <b dir="ltr" style={{ display: 'block', fontWeight: 600, textAlign: isFa ? 'right' : 'left' }}>
                        {t.name}
                      </b>
                      <span dir="ltr" style={{ display: 'block', color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.45, marginTop: 3, textAlign: isFa ? 'right' : 'left' }}>
                        {t.tagline}
                      </span>
                      <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 8 }}>
                        {isFa ? (TOOL_CATEGORY_LABELS_FA[t.category] ?? t.category) : t.category} · {isFa ? (PRICING_FA[t.pricing] ?? t.pricing) : t.pricing} · ★ {t.rating.toFixed(1)} · ▲{' '}
                        {t.votes.toLocaleString('en-US')}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <section aria-labelledby="tool-faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: '48px 0 64px', borderTop: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="lbl">{isFa ? '§ پرسش‌های متداول' : '§ FAQ'}</div>
            <h2
              id="tool-faq"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(28px,3vw,40px)' : 'clamp(32px,3.4vw,44px)',
                lineHeight: isFa ? 1.2 : 1.04,
                margin: '10px 0 14px',
                letterSpacing: isFa ? 0 : '-.02em',
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {isFa ? (
                <>
                  سوالات رایج درباره <em className="hi">{tool.name}.</em>
                </>
              ) : (
                <>
                  Questions about <em className="hi">{tool.name}.</em>
                </>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/tools/category/${categorySlug}`} className="tag">
                {isFa ? `همه ابزارهای ${catDisplay}` : `All ${tool.category} tools`}
              </Link>
              <Link href="/tools/collection/free" className="tag">
                {isFa ? 'ابزارهای رایگان AI' : 'Free AI tools'}
              </Link>
            </div>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {faqItems.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.8 : undefined }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          style={{
            marginBottom: 96,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'clamp(22px,3vw,40px)',
            borderRadius: 24,
            background: 'var(--vg-surface)',
            border: '1px solid var(--vg-orange-edge)',
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <h2
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(26px,2.8vw,38px)' : 'clamp(30px,3.2vw,44px)',
                margin: 0,
                lineHeight: isFa ? 1.22 : 1.04,
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {isFa ? (
                <>
                  خودتان می‌سازید؟ <em className="hi">یک کلید، همه مدل‌ها.</em>
                </>
              ) : (
                <>
                  Building your own? <em className="hi">One key, every model.</em>
                </>
              )}
            </h2>
            <p style={{ margin: '10px 0 0', color: 'var(--vg-ink2)', maxWidth: 560, lineHeight: isFa ? 1.75 : undefined }}>
              {isFa
                ? 'ویگاس از طریق یک اندپوینت سازگار با OpenAI با اعتبار پیش‌پرداخت و قیمت مستقیم، به تمام مدل‌های پیشتاز متصل می‌شود.'
                : 'Vigas routes to every frontier model through one OpenAI-compatible endpoint, with prepaid credits and honest prices.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/models" className="btn key" style={{ minHeight: 50 }}>
              {isFa ? 'مشاهده تعرفه مدل‌ها' : 'See model prices'}
            </Link>
            <Link href="/tools" className="btn gh" style={{ minHeight: 50 }}>
              {isFa ? 'همه ابزارها' : 'All tools'}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </LangShell>
  );
}

export async function ToolCategoryPageView({ category, lang = 'en' }: { category: ToolCategory; lang?: 'en' | 'fa' }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');

  const isFa = lang === 'fa';
  const tools = await getTools({ sort: 'votes' });
  const catTools = tools.filter((t) => t.category === category);
  const seo = (isFa ? TOOL_CATEGORY_SEO_FA : TOOL_CATEGORY_SEO)[category];
  const catDisplay = isFa ? (TOOL_CATEGORY_LABELS_FA[category] ?? category) : category;
  const lbHref = seo.relatedLeaderboard === 'overall' ? '/leaderboard' : `/leaderboard/${seo.relatedLeaderboard}`;
  const newsHref = isFa
    ? `/news/fa/category/${seo.relatedNewsCategory.toLowerCase()}`
    : `/news/category/${seo.relatedNewsCategory.toLowerCase()}`;
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const toolsLabel = isFa ? 'ابزارها' : 'Tools';

  return (
    <LangShell lang={lang}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: homeLabel, path: homeHref },
            { name: toolsLabel, path: '/tools' },
            { name: catDisplay, path: `/tools/category/${seo.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: seo.title,
            description: seo.description,
            inLanguage: lang,
            url: absoluteUrl(`/tools/category/${seo.slug}`),
            mainEntity: {
              '@type': 'ItemList',
              name: isFa ? `ابزارهای هوش مصنوعی ${catDisplay}` : `${category} AI tools`,
              numberOfItems: catTools.length,
              itemListElement: catTools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          ...(seo.faqs.length > 0 ? [faqLd(seo.faqs)] : []),
        ]}
      />
      <SiteHeader active="tools" lang={lang} />
      <main id="main" className="wrap">
        <Breadcrumb lang={lang} items={[{ name: homeLabel, href: homeHref }, { name: toolsLabel, href: '/tools' }, { name: catDisplay }]} style={{ paddingTop: 18 }} />
        <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(28px,3.2vw,40px)' : 'clamp(30px,3.6vw,44px)',
                lineHeight: isFa ? 1.15 : 1,
                letterSpacing: isFa ? 0 : '-.025em',
                fontWeight: isFa ? 700 : 400,
                margin: 0,
              }}
            >
              {isFa ? (
                <>
                  ابزارهای AI <em className="hi">{catDisplay}</em>
                </>
              ) : (
                <>
                  {category} <em className="hi">AI tools</em>
                </>
              )}
            </h1>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {isFa ? `${catTools.length} ابزار` : `${catTools.length} ${catTools.length === 1 ? 'app' : 'apps'}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={lbHref} className="btn gh" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
              {isFa ? 'لیدربورد مدل‌ها' : 'Leaderboard'}
              <Icon name="arrow" size={14} style={{ transform: isFa ? 'scaleX(-1)' : undefined }} />
            </Link>
          </div>
        </header>

        <section aria-label={isFa ? `ابزارهای ${catDisplay}` : `${category} tools`} style={{ paddingBottom: 56 }}>
          <ToolsDirectory
            key={`${lang}:${category}`}
            tools={tools}
            categories={TOOL_CATEGORIES}
            initialCategory={category}
            categoryMode="link"
            lang={lang}
          />
        </section>

        <section aria-labelledby="cat-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 36, padding: '44px 0 84px', borderTop: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="lbl">{isFa ? `§ راهنمای ${catDisplay} و پیوندها` : `§ ${category} guide & links`}</div>
            <h2
              id="cat-explore"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(26px,2.8vw,34px)' : 'clamp(28px,3vw,38px)',
                lineHeight: isFa ? 1.2 : 1.04,
                margin: '8px 0 12px',
                letterSpacing: isFa ? 0 : '-.02em',
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {seo.heading} <em className="hi">{seo.accent}</em>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--vg-ink2)', margin: '0 0 18px', maxWidth: 460, lineHeight: isFa ? 1.8 : undefined }}>{seo.intro}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={lbHref} className="tag">
                {isFa ? 'لیدربورد مدل‌ها' : 'Model leaderboard'}
              </Link>
              <Link href={newsHref} className="tag">
                {isFa ? `اخبار ${NEWS_CATEGORY_LABELS_FA[seo.relatedNewsCategory]}` : `${seo.relatedNewsCategory} news`}
              </Link>
              <Link href="/tools/collection/free" className="tag">
                {isFa ? 'ابزارهای رایگان AI' : 'Free AI tools'}
              </Link>
              <Link href="/tools/collection/vigas-api" className="tag">
                {isFa ? 'ابزارهای Vigas API' : 'Vigas API tools'}
              </Link>
              <Link href="/models" className="tag">
                {isFa ? 'تعرفه‌های API' : 'API prices'}
              </Link>
            </div>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {seo.faqs.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.8 : undefined }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </LangShell>
  );
}

export async function ToolCollectionPageView({ slug, lang = 'en' }: { slug: ToolCollectionSlug; lang?: 'en' | 'fa' }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools');

  const isFa = lang === 'fa';
  const tools = await getTools({ sort: 'votes' });
  const baseCol = TOOL_COLLECTIONS[slug];
  const col = isFa ? TOOL_COLLECTIONS_FA[slug] : baseCol;
  const colTools = tools.filter(baseCol.filter);
  const availableCategories = TOOL_CATEGORIES.filter((c) => colTools.some((t) => t.category === c));
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const toolsLabel = isFa ? 'ابزارها' : 'Tools';

  return (
    <LangShell lang={lang}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: homeLabel, path: homeHref },
            { name: toolsLabel, path: '/tools' },
            { name: col.name, path: `/tools/collection/${col.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: col.title,
            description: col.description,
            inLanguage: lang,
            url: absoluteUrl(`/tools/collection/${col.slug}`),
            mainEntity: {
              '@type': 'ItemList',
              name: col.name,
              numberOfItems: colTools.length,
              itemListElement: colTools.map((t, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/tools/${t.slug}`),
                name: t.name,
              })),
            },
          },
          ...(col.faqs.length > 0 ? [faqLd(col.faqs)] : []),
        ]}
      />
      <SiteHeader active="tools" lang={lang} />
      <main id="main" className="wrap">
        <Breadcrumb lang={lang} items={[{ name: homeLabel, href: homeHref }, { name: toolsLabel, href: '/tools' }, { name: col.name }]} style={{ paddingTop: 18 }} />
        <header style={{ padding: '10px 0 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(28px,3.2vw,40px)' : 'clamp(30px,3.6vw,44px)',
                lineHeight: isFa ? 1.15 : 1,
                letterSpacing: isFa ? 0 : '-.025em',
                fontWeight: isFa ? 700 : 400,
                margin: 0,
              }}
            >
              {col.name}
            </h1>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {isFa ? `${colTools.length} ابزار` : `${colTools.length} ${colTools.length === 1 ? 'app' : 'apps'}`}
            </span>
          </div>
          <Link href="/tools" className="btn gh" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }}>
            {isFa ? 'همه ابزارها' : 'All apps'}
            <Icon name="arrow" size={14} style={{ transform: isFa ? 'scaleX(-1)' : undefined }} />
          </Link>
        </header>

        <section aria-label={col.name} style={{ paddingBottom: 56 }}>
          <ToolsDirectory
            key={`${lang}:${slug}`}
            tools={colTools}
            categories={availableCategories}
            initialSort={slug === 'new' ? 'new' : 'votes'}
            lang={lang}
          />
        </section>

        <section aria-labelledby="col-explore" style={{ display: 'flex', flexWrap: 'wrap', gap: 36, padding: '44px 0 84px', borderTop: '1px solid var(--vg-line)' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div className="lbl">{isFa ? '§ درباره این مجموعه' : '§ About this collection'}</div>
            <h2
              id="col-explore"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(26px,2.8vw,34px)' : 'clamp(28px,3vw,38px)',
                lineHeight: isFa ? 1.2 : 1.04,
                margin: '8px 0 12px',
                letterSpacing: isFa ? 0 : '-.02em',
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {col.heading} <em className="hi">{col.accent}</em>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--vg-ink2)', margin: '0 0 18px', maxWidth: 460, lineHeight: isFa ? 1.8 : undefined }}>{col.intro}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(TOOL_COLLECTIONS) as ToolCollectionSlug[]).map((key) => (
                <Link key={key} href={`/tools/collection/${key}`} className="tag">
                  {(isFa ? TOOL_COLLECTIONS_FA : TOOL_COLLECTIONS)[key].name}
                </Link>
              ))}
              {TOOL_CATEGORIES.map((c) => (
                <Link key={c} href={`/tools/category/${c.toLowerCase()}`} className="tag">
                  {isFa ? `ابزارهای ${TOOL_CATEGORY_LABELS_FA[c]}` : `${c} tools`}
                </Link>
              ))}
            </div>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {col.faqs.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.8 : undefined }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </LangShell>
  );
}
