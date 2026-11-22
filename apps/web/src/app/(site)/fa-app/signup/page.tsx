import { RetroAuth } from '@/components/retro-auth';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'ساخت حساب کاربری — پنل API و چت هوش مصنوعی ویگاس',
    description:
      'حساب رایگان ویگاس بسازید: دسترسی هم‌زمان به پنل فروش و مدیریت کلید API، شارژ اعتبار و چت هوش مصنوعی.',
    path: '/signup',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaSignUpPage() {
  return (
    <main id="main">
      <RetroAuth initialMode="signup" lang="fa" />
    </main>
  );
}
