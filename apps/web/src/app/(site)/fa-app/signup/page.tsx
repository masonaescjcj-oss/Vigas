import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ساخت حساب کاربری — یک کلید API برای همه مدل‌ها',
    description:
      'حساب رایگان ویگاس بسازید: یک کلید API سازگار با OpenAI با سریع‌ترین مسیریابی، کمترین تعرفه مستقیم توکن و ۰٪ کارمزد تا ۵ دلار اول.',
    path: '/signup',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaSignUpPage() {
  return (
    <AuthPage
      lang="fa"
      crumb="ساخت حساب کاربری"
      title={
        <>
          یک کلید. <em className="hi">همه مدل‌ها.</em>
        </>
      }
      intro="یک حساب رایگان بسازید، کلید API اختصاصی دریافت کنید، اعتبار خود را با ۰٪ کارمزد تا ۵ دلار اول شارژ نمایید و بیش از ۲۵ مدل پیشتاز را صدا بزنید."
    >
      <AuthForm mode="signup" lang="fa" />
    </AuthPage>
  );
}
