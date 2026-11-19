import { RetroAuth } from '@/components/retro-auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ورود به حساب',
    description: 'برای دسترسی یکپارچه به چت هوش مصنوعی، مدیریت اعتبار کیف‌پول و کلیدهای API وارد ویگاس شوید.',
    path: '/signin',
    locale: 'fa_IR',
    noindex: true,
  }),
  robots: { index: false, follow: false },
};

export default function FaSignInPage() {
  return (
    <div dir="rtl" lang="fa" className="fa-ui">
      <SiteHeader ticker={false} lang="fa" />
      <main id="main">
        <RetroAuth initialMode="signin" lang="fa" />
      </main>
      <SiteFooter lang="fa" />
    </div>
  );
}
