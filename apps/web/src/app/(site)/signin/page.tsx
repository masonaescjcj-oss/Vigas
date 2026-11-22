import { RetroAuth } from '@/components/retro-auth';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Vigas to open your API Console, manage API keys, add credits, and use AI Chat.',
  path: '/signin',
  noindex: true,
});

export default function SignInPage() {
  return (
    <main id="main">
      <RetroAuth initialMode="signin" lang="en" />
    </main>
  );
}
