import { TermsView } from '@/components/legal/legal-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'Terms governing use of the Vigas website, public leaderboards, tools directory, and OpenAI-compatible AI gateway.',
  path: '/terms',
});

export default function TermsPage() {
  return <TermsView lang="en" />;
}
