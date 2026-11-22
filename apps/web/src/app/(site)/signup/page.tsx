import { RetroAuth } from '@/components/retro-auth';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Create Account — Vigas API & AI Chat',
  description:
    'Create a free Vigas account: one account for your Vigas API Console, OpenAI-compatible API keys, prepaid credits, and AI Chat.',
  path: '/signup',
});

export default function SignUpPage() {
  return (
    <main id="main">
      <RetroAuth initialMode="signup" lang="en" />
    </main>
  );
}
