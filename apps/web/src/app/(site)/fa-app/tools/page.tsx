import { ToolsIndexView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'بهترین ابزارهای هوش مصنوعی ۲۰۲۶ — دایرکتوری تخصصی اپلیکیشن‌های AI',
    description:
      'کشف و مقایسه ایجنت‌های کدنویسی، دستیارهای پژوهش، استودیوهای تصویر، مولدهای ویدیو و ابزارهای صوت و بهره‌وری هوش مصنوعی در ویگاس با رأی توسعه‌دهندگان.',
    path: '/tools',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaToolsPage() {
  return <ToolsIndexView lang="fa" />;
}
