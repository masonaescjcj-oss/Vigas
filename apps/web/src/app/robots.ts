import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/admin', '/auth', '/signin', '/embed/'] },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  };
}
