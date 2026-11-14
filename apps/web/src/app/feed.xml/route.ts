import { getNews } from '@/lib/data';
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/env';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const { items } = await getNews({ limit: 30 });
  const buildDate = items[0]?.publishedAt ? new Date(items[0].publishedAt).toUTCString() : new Date().toUTCString();

  const entries = items
    .map((item) => {
      const link = absoluteUrl(`/news/${item.slug}`);
      const pubDate = new Date(item.publishedAt).toUTCString();
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <category>${escapeXml(item.category)}</category>`,
        `      <dc:language>${escapeXml(item.lang ?? 'en')}</dc:language>`,
        `      <description>${escapeXml(item.dek)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(`${SITE_NAME} AI Newsroom`)}</title>`,
    `    <link>${escapeXml(`${SITE_URL}/news`)}</link>`,
    `    <description>${escapeXml(DEFAULT_DESCRIPTION)}</description>`,
    '    <language>en-us</language>',
    `    <lastBuildDate>${escapeXml(buildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(absoluteUrl('/feed.xml'))}" rel="self" type="application/rss+xml" />`,
    entries,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
