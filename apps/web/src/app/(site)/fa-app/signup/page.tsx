import { RetroAuth } from '@/components/retro-auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ساخت حساب کاربری — چت AI و کلید API یکپارچه',
    description:
      'حساب رایگان ویگاس بسازید: دسترسی هم‌زمان به چت هوش مصنوعی، یک کلید API سازگار با OpenAI و ۰٪ کارمزد تا ۵ دلار اول.',
    path: '/signup',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaSignUpPage() {
  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader ticker={false} lang="fa" />
      <main id="main">
        <RetroAuth initialMode="signup" lang="fa" />
      </main>
      <SiteFooter lang="fa" />
    </div>
  );
}
