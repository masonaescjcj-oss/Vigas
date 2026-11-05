import type { Metadata } from 'next';
import { absoluteUrl, SITE_NAME, SITE_URL } from './env';

export const DEFAULT_DESCRIPTION =
  'One API key for every frontier AI model, prepaid credits and honest per-token prices — plus a public AI leaderboard built from real use, AI news and the best AI tools.';

interface PageMetaInput {
  title: string;
  description: string;
  /** Path with query, e.g. "/news?category=Models". Used for the canonical URL. */
  path: string;
  /** Use the title as is, without the " | Vigas" suffix. */
  absoluteTitle?: boolean;
  type?: 'website' | 'article';
  noindex?: boolean;
  article?: { publishedTime: string; modifiedTime: string; authors: string[]; section: string };
}

/** Title, description, canonical URL, Open Graph and Twitter tags for a page. */
export function pageMetadata(input: PageMetaInput): Metadata {
  const fullTitle = input.absoluteTitle ? input.title : `${input.title} | ${SITE_NAME}`;
  const url = absoluteUrl(input.path);
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path },
    robots: input.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: fullTitle,
      description: input.description,
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
    twitter: { card: 'summary_large_image', title: fullTitle, description: input.description },
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

export const organizationLd = (): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/icon.svg'),
  description: DEFAULT_DESCRIPTION,
});

export const websiteLd = (): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/tools?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});
