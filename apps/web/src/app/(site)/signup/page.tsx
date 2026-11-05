import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Create your account — one API key for every AI model',
  description:
    'Create a free Vigas account: one OpenAI-compatible API key for every frontier model, prepaid credits with zero markup on your first $5, Vigas Chat and the Arena.',
  path: '/signup',
});

export default function SignUpPage() {
  return (
    <AuthPage
      crumb="Create account"
      title={
        <>
          One key. <em className="hi">Every model.</em>
        </>
      }
      intro="Create a free account to get your API key, add prepaid credits and start chatting with any model."
    >
      <AuthForm mode="signup" />
    </AuthPage>
  );
}
