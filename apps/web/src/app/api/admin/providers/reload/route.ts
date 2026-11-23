import { requireAdmin } from '@/lib/admin';
import { reloadGatewayPools } from '@/lib/admin-gateway';
import { privateJson } from '@/lib/http';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const result = await reloadGatewayPools();
  return privateJson(result);
}
