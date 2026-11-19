import type { MetadataRoute } from 'next';
import { LEADERBOARD_CATEGORIES, NEWS_CATEGORIES, TOOL_CATEGORIES } from '@vigas/core';
import { getNews, getSitemapData } from '@/lib/data';
import { absoluteUrl } from '@/lib/env';
import { getArticleAlternate } from '@/lib/media';
import { TOOL_COLLECTIONS } from '@/lib/seo-catalog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ articles, tools }, enCatChecks, faCatChecks] = await Promise.all([
    getSitemapData(),
    Promise.all(NEWS_CATEGORIES.map((c) => getNews({ category: c, lang: 'en', limit: 1 }))),
    Promise.all(NEWS_CATEGORIES.map((c) => getNews({ category: c, lang: 'fa', limit: 1 }))),
  ]);
  const newest = articles[0]?.updatedAt ?? new Date().toISOString();
  const enCats = new Map(NEWS_CATEGORIES.map((c, i) => [c, enCatChecks[i]!]));
  const faCats = new Map(NEWS_CATEGORIES.map((c, i) => [c, faCatChecks[i]!]));

  const entry = (
    path: string,
    changeFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly',
    priority: number,
    lastModified: string = newest,
    languages?: Record<string, string>,
  ): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
    lastModified,
    ...(languages
      ? {
          alternates: {
            languages: Object.fromEntries(Object.entries(languages).map(([k, v]) => [k, absoluteUrl(v)])),
          },
        }
      : {}),
  });

  const homeLangs = { en: '/', fa: '/fa', 'x-default': '/' };
  const newsLangs = { en: '/news', fa: '/news/fa', 'x-default': '/news' };

  return [
    entry('/', 'hourly', 1, newest, homeLangs),
    entry('/fa', 'hourly', 1, newest, homeLangs),
    entry('/chat', 'weekly', 0.9, newest),
    entry('/models', 'daily', 0.9, newest),
    entry('/leaderboard', 'hourly', 0.9, newest),
    ...LEADERBOARD_CATEGORIES.filter((c) => c.id !== 'overall').map((c) => entry(`/leaderboard/${c.id}`, 'daily', 0.8, newest)),
    entry('/news', 'hourly', 0.9, newest, newsLangs),
    entry('/news/fa', 'hourly', 0.9, newest, newsLangs),
    ...NEWS_CATEGORIES.flatMap((c) => {
      const slug = c.toLowerCase();
      const en = enCats.get(c);
      const fa = faCats.get(c);
      const hasEn = Boolean(en && en.total > 0);
      const hasFa = Boolean(fa && fa.total > 0);
      const out: MetadataRoute.Sitemap = [];
      if (hasEn) {
        const langs = hasFa ? { en: `/news/category/${slug}`, fa: `/news/fa/category/${slug}`, 'x-default': `/news/category/${slug}` } : undefined;
        out.push(entry(`/news/category/${slug}`, 'daily', 0.7, en?.items[0]?.publishedAt ?? newest, langs));
      }
      if (hasFa) {
        const langs = hasEn ? { en: `/news/category/${slug}`, fa: `/news/fa/category/${slug}`, 'x-default': `/news/category/${slug}` } : undefined;
        out.push(entry(`/news/fa/category/${slug}`, 'daily', 0.7, fa?.items[0]?.publishedAt ?? newest, langs));
      }
      return out;
    }),
    ...articles.map((a) => {
      const alt = getArticleAlternate(a.slug);
      const isFa = a.slug.startsWith('fa-');
      const langs = alt
        ? isFa
          ? { fa: `/news/${a.slug}`, en: `/news/${alt.slug}`, 'x-default': `/news/${alt.slug}` }
          : { en: `/news/${a.slug}`, fa: `/news/${alt.slug}`, 'x-default': `/news/${a.slug}` }
        : undefined;
      return entry(`/news/${a.slug}`, 'weekly', 0.8, a.updatedAt, langs);
    }),
    entry('/tools', 'daily', 0.9, newest),
    ...TOOL_CATEGORIES.map((c) => entry(`/tools/category/${c.toLowerCase()}`, 'daily', 0.8, newest)),
    ...Object.keys(TOOL_COLLECTIONS).map((slug) => entry(`/tools/collection/${slug}`, 'daily', 0.7, newest)),
    ...tools.map((t) => entry(`/tools/${t.slug}`, 'weekly', 0.7, newest)),
    entry('/privacy', 'monthly', 0.3, newest),
    entry('/terms', 'monthly', 0.3, newest),
    entry('/signup', 'monthly', 0.4, newest),
  ];
}
