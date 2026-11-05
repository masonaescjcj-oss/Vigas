import { getArticleBySlug } from '@/lib/data';
import { apiError, publicJson } from '@/lib/http';

export async function GET(_req: Request, ctx: RouteContext<'/api/app/news/[slug]'>) {
  const { slug } = await ctx.params;
  const article = slug.length <= 200 ? await getArticleBySlug(slug) : null;
  if (!article) return apiError(404, 'not_found', 'Article not found.');
  return publicJson(article);
}
