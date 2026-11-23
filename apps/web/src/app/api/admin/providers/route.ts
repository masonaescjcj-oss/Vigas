import { adminDeleteUpstreamProvider, adminListUpstreamProviders, adminSaveUpstreamProvider, getDb } from '@vigas/db';
import { adminErrorResponse, requireAdmin } from '@/lib/admin';
import { fetchGatewayPools, reloadGatewayPools } from '@/lib/admin-gateway';
import { apiError, privateJson } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  try {
    const [providers, gateway] = await Promise.all([adminListUpstreamProviders(getDb()), fetchGatewayPools()]);
    return privateJson({ providers, gateway });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  try {
    const saved = await adminSaveUpstreamProvider(getDb(), body as never);
    const reload = await reloadGatewayPools();
    return privateJson({ ...saved, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const slug = new URL(req.url).searchParams.get('slug')?.trim();
  if (!slug) return apiError(400, 'invalid_input', 'Query parameter "slug" is required.');
  try {
    await adminDeleteUpstreamProvider(getDb(), slug);
    const reload = await reloadGatewayPools();
    return privateJson({ deleted: slug, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
