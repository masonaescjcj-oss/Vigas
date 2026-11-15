import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ToolDetailPageView } from '@/components/tools/tools-views';
import { getToolBySlug, getTools } from '@/lib/data';
import { pageMetadata } from '@/lib/seo';

/** Unknown params wait for the full render, so missing pages get a real 404 status. */
export const ensureStatic = 'navigation';
export const instant = false;

export async function generateStaticParams() {
  const tools = await getTools({ sort: 'votes' });
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<'/tools/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: 'Tool not found', robots: { index: false } };
  const tagline = tool.tagline.replace(/\.$/, '');
  const rawDesc = `${tool.name} (${tool.pricing}, ★ ${tool.rating.toFixed(1)}/5): ${tagline}. Compare pricing, features, and ${tool.category.toLowerCase()} alternatives on Vigas.`;
  const description = rawDesc.length > 160 ? `${rawDesc.slice(0, 157).trimEnd()}...` : rawDesc;
  return pageMetadata({
    title: `${tool.name} — ${tagline}`,
    description,
    path: `/tools/${tool.slug}`,
    image: `/og/tool/${tool.slug}`,
    imageAlt: `${tool.name} — ${tool.category} AI tool review on Vigas`,
  });
}

export default async function ToolPage({ params }: PageProps<'/tools/[slug]'>) {
  const { slug } = await params;
  if (slug.length > 200 || !(await getToolBySlug(slug))) notFound();
  return <ToolDetailPageView slug={slug} lang="en" />;
}
