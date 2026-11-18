import { AuthForm } from '@/components/auth-form';
import { AuthPage } from '@/components/auth-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ورود به حساب',
    description: 'برای مدیریت اعتبار پیش‌پرداخت، کلیدهای API و مصرف مدل‌های هوش مصنوعی وارد ویگاس شوید.',
    path: '/signin',
    locale: 'fa_IR',
    noindex: true,
  }),
  robots: { index: false, follow: false },
};

export default function FaSignInPage() {
  return (
    <AuthPage
      lang="fa"
      crumb="ورود به حساب"
      path="/signin"
      title={
        <>
          خوش <em className="hi">برگشتید.</em>
        </>
      }
      intro="برای مدیریت اعتبار کیف‌پول، ساخت یا لغو کلیدهای API و مشاهده آمار مصرف زنده وارد حساب کاربری خود شوید."
    >
      <AuthForm mode="signin" lang="fa" />
    </AuthPage>
  );
}
