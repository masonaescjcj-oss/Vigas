import { getNews } from '@/lib/data';
import { absoluteUrl, SITE_NAME } from '@/lib/env';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function GET() {
  const { items } = await getNews({ limit: 50 });
  const cutoff = Date.now() - NEWS_WINDOW_MS;
  const fresh = items.filter((item) => new Date(item.publishedAt).getTime() >= cutoff);
  const recent = fresh.length > 0 ? fresh : items.slice(0, 10);

  const urlNodes = recent
    .map((item) => {
      const loc = absoluteUrl(`/news/${item.slug}`);
      const pubIso = new Date(item.publishedAt).toISOString();
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        `        <news:name>${escapeXml(SITE_NAME)}</news:name>`,
        `        <news:language>${escapeXml(item.lang ?? 'en')}</news:language>`,
        '      </news:publication>',
        `      <news:publication_date>${escapeXml(pubIso)}</news:publication_date>`,
        `      <news:title>${escapeXml(item.title)}</news:title>`,
        `      <news:keywords>${escapeXml(`${item.category}, AI, ${SITE_NAME}`)}</news:keywords>`,
        '    </news:news>',
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urlNodes,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
