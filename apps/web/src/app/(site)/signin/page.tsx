import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Vigas to manage your credits and API keys, chat with any AI model and vote in the Arena.',
  path: '/signin',
  noindex: true,
});

export default function SignInPage() {
  return (
    <AuthPage
      crumb="Sign in"
      title={
        <>
          Welcome <em className="hi">back.</em>
        </>
      }
      intro="Sign in to your credits, keys and chats. The same account works in Vigas Chat, RetroBuild and the Android app."
    >
      <AuthForm mode="signin" />
    </AuthPage>
  );
}
