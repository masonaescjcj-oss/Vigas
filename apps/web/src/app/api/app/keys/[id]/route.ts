import { z } from 'zod';
import { getDb, revokeApiKey, setApiKeyLimit } from '@vigas/db';
import { apiError, privateJson, readJson, requireAuth } from '@/lib/http';

const limitSchema = z.object({
  monthlyLimitMicros: z
    .number()
    .int('monthlyLimitMicros must be an integer.')
    .min(1_000_000, 'The smallest monthly limit is $1.')
    .max(100_000_000_000, 'The largest monthly limit is $100,000.')
    .nullable(),
});

export async function PATCH(req: Request, ctx: RouteContext<'/api/app/keys/[id]'>) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  if (!id || id.length > 100) return apiError(404, 'not_found', 'API key not found.');

  const body = await readJson(req, limitSchema);
  if (!body.ok) return body.res;

  const ok = await setApiKeyLimit(getDb(), auth.user.accountId, id, body.data.monthlyLimitMicros);
  if (!ok) return apiError(404, 'not_found', 'API key not found.');
  return privateJson({ ok: true, monthlyLimitMicros: body.data.monthlyLimitMicros });
}

export async function DELETE(req: Request, ctx: RouteContext<'/api/app/keys/[id]'>) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const ok = id.length <= 100 && (await revokeApiKey(getDb(), auth.user.accountId, id));
  if (!ok) return apiError(404, 'not_found', 'API key not found.');
  return privateJson({ ok: true });
}
