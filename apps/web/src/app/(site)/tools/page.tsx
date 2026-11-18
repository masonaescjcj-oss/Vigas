import { ToolsIndexView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Best AI Tools of 2026 — App Directory',
  description:
    'Discover 24 verified AI coding agents, research apps, image studios, video & voice tools ranked by builder upvotes and real ratings on Vigas.',
  path: '/tools',
});

export default function ToolsPage() {
  return <ToolsIndexView lang="en" />;
}
