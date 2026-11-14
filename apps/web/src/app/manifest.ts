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
    background_color: '#12110F',
    theme_color: '#12110F',
    icons: [
      {
        src: '/icon.svg',
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
