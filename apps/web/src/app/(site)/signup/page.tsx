import { RetroAuth } from '@/components/retro-auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Create Account — One Key & AI Chat',
  description:
    'Create a free Vigas account: one account for Vigas AI Chat, OpenAI-compatible API keys, lowest pass-through token pricing, and zero markup on your first $5.',
  path: '/signup',
});

export default function SignUpPage() {
  return (
    <>
      <SiteHeader ticker={false} lang="en" />
      <main id="main">
        <RetroAuth initialMode="signup" lang="en" />
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
