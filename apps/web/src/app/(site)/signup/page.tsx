import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Create your account — one API key for every AI model',
  description:
    'Create a free Vigas account: one OpenAI-compatible API key with fast edge routing, lowest pass-through token pricing, and zero markup on your first $5.',
  path: '/signup',
});

export default function SignUpPage() {
  return (
    <AuthPage
      lang="en"
      crumb="Create account"
      title={
        <>
          One key. <em className="hi">Every model.</em>
        </>
      }
      intro="Create a free account to generate your API key, add prepaid credits with $0 markup on your first $5, and call 25+ models."
    >
      <AuthForm mode="signup" lang="en" />
    </AuthPage>
  );
}
