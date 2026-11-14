import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/article/article-view';
import { ReadingProgress } from '@/components/article/reading-progress';
import { SiteHeader } from '@/components/site-header';
import { getArticleBySlug, getSitemapData } from '@/lib/data';
import { pageMetadata } from '@/lib/seo';

/** Unknown params wait for the full render, so missing pages get a real 404 status. */
export const ensureStatic = 'navigation';
/** URL validation runs before streaming so missing slugs emit real 404s without dev warnings. */
export const instant = false;

export async function generateStaticParams() {
  const { articles } = await getSitemapData();
  if (articles.length === 0) return [{ slug: '__placeholder__' }];
  return articles.slice(0, 100).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<'/news/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: 'Story not found', robots: { index: false } };
  return pageMetadata({
    title: article.title,
    description: article.dek,
    path: `/news/${article.slug}`,
    image: `/og/news/${article.slug}`,
    imageAlt: article.title,
    article: {
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
      section: article.category,
    },
  });
}

export default async function ArticlePage({ params }: PageProps<'/news/[slug]'>) {
  const { slug } = await params;
  // Resolve before streaming starts so unknown slugs get a real 404 status.
  if (slug.length > 200 || !(await getArticleBySlug(slug))) notFound();
  return (
    <>
      <SiteHeader active="news" ticker={false} />
      <ReadingProgress />
      <main id="main">
        <ArticleView slug={slug} />
      </main>
    </>
  );
}
