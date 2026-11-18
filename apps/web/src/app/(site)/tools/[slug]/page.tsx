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

function clampWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

export async function generateMetadata({ params }: PageProps<'/tools/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: 'Tool not found', robots: { index: false } };
  const tagline = tool.tagline.replace(/\.$/, '');
  const fullTaglineTitle = `${tool.name} — ${tagline}`;
  const title =
    fullTaglineTitle.length <= 52
      ? fullTaglineTitle
      : `${tool.name} — ${tool.category} AI Tool (${tool.pricing})`.length <= 52
        ? `${tool.name} — ${tool.category} AI Tool (${tool.pricing})`
        : `${tool.name} — ${tool.category} AI App`;
  const rawDesc = `${tool.name} (${tool.pricing}, ★ ${tool.rating.toFixed(1)}/5): ${tagline}. Compare pricing, features & ${tool.category.toLowerCase()} alternatives on Vigas.`;
  const description = clampWords(rawDesc, 155);
  return pageMetadata({
    title,
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
