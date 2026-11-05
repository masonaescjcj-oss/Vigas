import { z } from 'zod';
import { completeTopup, getDb } from '@vigas/db';
import { serverEnv } from '@/lib/env';
import { apiError, privateJson, rateLimit, readJson, requireAuth } from '@/lib/http';

const MIN = 1_000_000; // $1
const MAX = 1_000_000_000; // $1,000

const schema = z.object({
  amountMicros: z
    .number()
    .int('amountMicros must be an integer.')
    .min(MIN, 'The minimum top-up is $1.')
    .max(MAX, 'The maximum top-up is $1,000.'),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const env = serverEnv();
  if (env.paymentProvider !== 'test') {
    return apiError(501, 'payments_not_configured', 'Card payments are not available yet. Credits cannot be added right now.');
  }
  const limited = rateLimit(`topup:${auth.user.id}`, 20, 60_000);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const result = await completeTopup(getDb(), {
    accountId: auth.user.accountId,
    amountMicros: body.data.amountMicros,
    feeBps: env.topupFeeBps,
    provider: 'test',
  });
  return privateJson(result);
}
