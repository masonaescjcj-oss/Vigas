import { cacheLife, cacheTag } from 'next/cache';
import { ChatApp } from '@/components/chat/chat-app';
import { getModels } from '@/lib/data';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Vigas Chat — chat with any AI model, or two at once',
  description:
    'Vigas Chat: talk to Claude, GPT, Gemini, DeepSeek and every other model in the Vigas gateway with one account, or run blind Arena battles that feed the public AI leaderboard.',
  path: '/chat',
  noindex: true,
});

export default async function ChatPage() {
  'use cache';
  cacheLife('content');
  cacheTag('models');
  const models = await getModels();
  return (
    <ChatApp
      models={models.map((m) => ({
        id: m.id,
        name: m.name,
        org: m.org,
        inputPerMillionMicros: m.inputPerMillionMicros,
        outputPerMillionMicros: m.outputPerMillionMicros,
      }))}
    />
  );
}
