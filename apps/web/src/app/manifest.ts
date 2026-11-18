import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/env';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI Models, Leaderboard, News & Tools`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#171614',
    theme_color: '#171614',
    icons: [
      {
        src: '/icons/icon-48.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/icons/icon-96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    shortcuts: [
      { name: 'AI Leaderboard', url: '/leaderboard', description: 'Live rankings built from real AI sessions' },
      { name: 'AI Tools Directory', url: '/tools', description: 'Best AI tools ranked by builders' },
      { name: 'AI Newsroom', url: '/news', description: 'Model releases, agents, and pricing news' },
      { name: 'Models & Pricing', url: '/models', description: 'Per-token prices across frontier AI providers' },
    ],
  };
}
