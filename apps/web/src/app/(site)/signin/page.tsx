import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Vigas to manage your prepaid credits, API keys, and usage across every AI model.',
  path: '/signin',
  noindex: true,
});

export default function SignInPage() {
  return (
    <AuthPage
      lang="en"
      crumb="Sign in"
      path="/signin"
      title={
        <>
          Welcome <em className="hi">back.</em>
        </>
      }
      intro="Sign in to manage your credits, API keys, and live usage analytics across every connected coding app and server."
    >
      <AuthForm mode="signin" lang="en" />
    </AuthPage>
  );
}
