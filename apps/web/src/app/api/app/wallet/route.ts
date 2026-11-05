import { getDb, getWallet } from '@vigas/db';
import { serverEnv } from '@/lib/env';
import { apiError, privateJson, requireAuth } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const wallet = await getWallet(getDb(), auth.user.accountId, serverEnv().topupFeeBps);
  if (!wallet) return apiError(404, 'not_found', 'Billing account not found.');
  return privateJson(wallet);
}
