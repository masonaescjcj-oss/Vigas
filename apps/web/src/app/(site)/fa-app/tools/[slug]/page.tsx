import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ToolDetailPageView } from '@/components/tools/tools-views';
import { getToolBySlug, getTools } from '@/lib/data';
import { pageMetadata } from '@/lib/seo';
import { TOOL_CATEGORY_LABELS_FA } from '@/lib/seo-catalog';

export const ensureStatic = 'navigation';
export const instant = false;

export async function generateStaticParams() {
  const tools = await getTools({ sort: 'votes' });
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: 'ابزار یافت نشد', robots: { index: false, follow: false } };
  const tagline = tool.tagline.replace(/\.$/, '');
  const catFa = TOOL_CATEGORY_LABELS_FA[tool.category] ?? tool.category;
  const pricingFa = tool.pricing === 'Free' ? 'رایگان' : tool.pricing === 'Freemium' ? 'فریمیوم' : 'پولی';
  const rawDesc = `${tool.name} (${pricingFa}، ★ ${tool.rating.toFixed(1)}/5): ${tagline}. مقایسه تعرفه، امکانات و جایگزین‌های دسته ${catFa} در ویگاس.`;
  const description = rawDesc.length > 160 ? `${rawDesc.slice(0, 157).trimEnd()}...` : rawDesc;
  return {
    ...pageMetadata({
      title: `${tool.name} — بررسی و جایگزین‌های ${catFa}`,
      description,
      path: `/tools/${tool.slug}`,
      locale: 'fa_IR',
      image: `/og/tool/${tool.slug}`,
      imageAlt: `نقد و بررسی ابزار ${tool.name} در ویگاس`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function FaToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 200 || !(await getToolBySlug(slug))) notFound();
  return <ToolDetailPageView slug={slug} lang="fa" />;
}
