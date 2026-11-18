import { ModelsView } from '@/components/models/models-view';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI Models & Live API Token Pricing',
  description:
    'Compare live AI API token prices, context windows & latency for Claude, GPT, Gemini & DeepSeek. One OpenAI-compatible key, $0 markup on first $5.',
  path: '/models',
});

export default function ModelsPage() {
  return <ModelsView lang="en" />;
}
