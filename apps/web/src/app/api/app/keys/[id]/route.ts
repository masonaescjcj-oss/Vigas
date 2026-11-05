import { getDb, revokeApiKey } from '@vigas/db';
import { apiError, privateJson, requireAuth } from '@/lib/http';

export async function DELETE(req: Request, ctx: RouteContext<'/api/app/keys/[id]'>) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const ok = id.length <= 100 && (await revokeApiKey(getDb(), auth.user.accountId, id));
  if (!ok) return apiError(404, 'not_found', 'API key not found.');
  return privateJson({ ok: true });
}
