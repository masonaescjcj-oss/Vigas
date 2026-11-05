import { getDb, toggleToolVote } from '@vigas/db';
import { apiError, privateJson, rateLimit, requireAuth } from '@/lib/http';

export async function POST(req: Request, ctx: RouteContext<'/api/app/tools/[slug]/vote'>) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const limited = rateLimit(`vote:${auth.user.id}`, 60, 60_000);
  if (limited) return limited;
  const { slug } = await ctx.params;
  const result = slug.length <= 200 ? await toggleToolVote(getDb(), slug, auth.user.id) : null;
  if (!result) return apiError(404, 'not_found', 'Tool not found.');
  return privateJson(result);
}
