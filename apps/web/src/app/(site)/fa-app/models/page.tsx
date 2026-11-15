import { ModelsView } from '@/components/models/models-view';
import { pageMetadata } from '@/lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'مدل‌ها و تعرفه زنده API هوش مصنوعی',
    description:
      'مقایسه قیمت لحظه‌ای توکن، پنجره متنی و تأخیر مدل‌های Claude، GPT، Gemini و DeepSeek در گیت‌وی سازگار با OpenAI ویگاس — با ۰٪ کارمزد تا ۵ دلار اول.',
    path: '/models',
    locale: 'fa_IR',
  }),
  robots: { index: false, follow: false },
};

export default function FaModelsPage() {
  return <ModelsView lang="fa" />;
}
