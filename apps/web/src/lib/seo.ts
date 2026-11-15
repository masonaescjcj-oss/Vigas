import type { Metadata } from 'next';
import { absoluteUrl, SITE_NAME, SITE_URL } from './env';

export const DEFAULT_DESCRIPTION =
  'Fastest low-latency AI API gateway with the lowest pass-through token prices across every frontier model — plus a public AI leaderboard, multilingual AI news, and curated AI tools.';

interface PageMetaInput {
  title: string;
  description: string;
  /** Path with query, e.g. "/tools/cursor". Used for the canonical URL. */
  path: string;
  /** Use the title as is, without the " | Vigas" suffix. */
  absoluteTitle?: boolean;
  type?: 'website' | 'article';
  noindex?: boolean;
  locale?: string;
  alternatesLanguages?: Record<string, string>;
  image?: string;
  imageAlt?: string;
  article?: { publishedTime: string; modifiedTime: string; authors: string[]; section: string };
}

/** Title, description, canonical URL, Open Graph and Twitter tags for a page. */
export function pageMetadata(input: PageMetaInput): Metadata {
  const fullTitle = input.absoluteTitle ? input.title : `${input.title} | ${SITE_NAME}`;
  const url = absoluteUrl(input.path);
  const ogImage = absoluteUrl(input.image ?? '/opengraph-image');
  const ogAlt = input.imageAlt ?? fullTitle;
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
      ...(input.alternatesLanguages ? { languages: input.alternatesLanguages } : {}),
      types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} AI News RSS` }] },
    },
    robots: input.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      siteName: SITE_NAME,
      locale: input.locale ?? 'en_US',
      url,
      title: fullTitle,
      description: input.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt }],
      ...(input.article
        ? {
            type: 'article',
            publishedTime: input.article.publishedTime,
            modifiedTime: input.article.modifiedTime,
            authors: input.article.authors,
            section: input.article.section,
          }
        : { type: 'website' }),
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description: input.description, images: [ogImage] },
  };
}

export type JsonLdObject = Record<string, unknown>;

export function breadcrumbLd(items: Array<{ name: string; path: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqLd(items: Array<{ q: string; a: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export const organizationLd = (lang: 'en' | 'fa' = 'en'): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: lang === 'fa' ? 'ویگاس (Vigas)' : SITE_NAME,
  url: lang === 'fa' ? `${SITE_URL}/fa` : SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl('/icon.svg'),
    width: 512,
    height: 512,
  },
  description:
    lang === 'fa'
      ? 'سریع‌ترین و ارزان‌ترین گیت‌وی API هوش مصنوعی برای دسترسی یکپارچه به مدل‌های پیشتاز، همراه با لیدربورد زنده Arena، اخبار تخصصی AI و دایرکتوری ابزارها.'
      : DEFAULT_DESCRIPTION,
});

export const websiteLd = (lang: 'en' | 'fa' = 'en'): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': lang === 'fa' ? `${SITE_URL}/fa#website` : `${SITE_URL}/#website`,
  name: lang === 'fa' ? 'ویگاس — API هوش مصنوعی، لیدربورد و اخبار AI' : SITE_NAME,
  url: lang === 'fa' ? `${SITE_URL}/fa` : SITE_URL,
  inLanguage: lang === 'fa' ? 'fa-IR' : 'en-US',
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/tools?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});
