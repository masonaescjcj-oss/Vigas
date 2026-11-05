import { z } from 'zod';
import { createApiKey, getDb, listApiKeys } from '@vigas/db';
import { apiError, privateJson, rateLimit, readJson, requireAuth } from '@/lib/http';

const MAX_KEYS = 25;

const schema = z.object({
  name: z.string().trim().min(1, 'Give the key a name.').max(80, 'Key names are at most 80 characters.'),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const limited = rateLimit(`keys:${auth.user.id}`, 20, 60_000);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const db = getDb();
  const existing = await listApiKeys(db, auth.user.accountId);
  if (existing.length >= MAX_KEYS) {
    return apiError(409, 'too_many_keys', `You can have up to ${MAX_KEYS} active keys. Revoke one first.`);
  }
  const key = await createApiKey(db, auth.user.accountId, body.data.name);
  return privateJson(key, { status: 201 });
}
