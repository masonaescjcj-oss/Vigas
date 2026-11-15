import { ModelsView } from '@/components/models/models-view';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI models & API pricing — fastest, lowest-cost gateway',
  description:
    'Compare live AI API token prices, context windows, and edge latency for Claude, GPT, Gemini & DeepSeek. One OpenAI-compatible key with $0 markup on your first $5.',
  path: '/models',
});

export default function ModelsPage() {
  return <ModelsView lang="en" />;
}
