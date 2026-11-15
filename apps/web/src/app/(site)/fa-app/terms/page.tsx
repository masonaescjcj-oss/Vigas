import { TermsView } from '@/components/legal/legal-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'قوانین استفاده',
    description: 'شرایط استفاده از وب‌سایت، لیدربورد عمومی، دایرکتوری ابزارها و گیت‌وی API سازگار با OpenAI ویگاس.',
    path: '/terms',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaTermsPage() {
  return <TermsView lang="fa" />;
}
