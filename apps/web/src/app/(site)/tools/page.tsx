import { ToolsIndexView } from '@/components/tools/tools-views';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Best AI tools of 2026 — curated app directory',
  description:
    'Discover verified AI coding agents, research workspaces, image studios, video generators, voice tools, and productivity apps on Vigas — tested and upvoted by builders.',
  path: '/tools',
});

export default function ToolsPage() {
  return <ToolsIndexView lang="en" />;
}
