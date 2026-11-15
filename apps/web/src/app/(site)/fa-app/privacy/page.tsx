import { PrivacyView } from '@/components/legal/legal-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'حریم خصوصی',
    description: 'نحوه نگهداری اطلاعات حساب، لاگ‌های گیت‌وی API و آمارهای ناشناس لیدربورد در ویگاس.',
    path: '/privacy',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaPrivacyPage() {
  return <PrivacyView lang="fa" />;
}
