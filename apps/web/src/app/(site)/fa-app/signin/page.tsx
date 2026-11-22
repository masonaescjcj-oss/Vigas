import { RetroAuth } from '@/components/retro-auth';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ورود به حساب',
    description: 'برای ورود به پنل API، مدیریت اعتبار کیف‌پول، کلیدهای API و چت هوش مصنوعی وارد ویگاس شوید.',
    path: '/signin',
    locale: 'fa_IR',
    noindex: true,
  }),
  robots: { index: false, follow: false },
};

export default function FaSignInPage() {
  return (
    <main id="main">
      <RetroAuth initialMode="signin" lang="fa" />
    </main>
  );
}
