import { RetroAuth } from '@/components/retro-auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Vigas to access AI Chat, prepaid credits, API keys, and usage across every model.',
  path: '/signin',
  noindex: true,
});

export default function SignInPage() {
  return (
    <>
      <SiteHeader ticker={false} lang="en" />
      <main id="main">
        <RetroAuth initialMode="signin" lang="en" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
