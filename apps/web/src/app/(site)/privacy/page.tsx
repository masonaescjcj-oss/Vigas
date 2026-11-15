import { PrivacyView } from '@/components/legal/legal-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'How Vigas handles account details, API gateway logs, anonymized leaderboard statistics, and privacy choices.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return <PrivacyView lang="en" />;
}
