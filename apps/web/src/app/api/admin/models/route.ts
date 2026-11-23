import { revalidateTag } from 'next/cache';
import { adminDeleteEndpoint, adminDeleteModel, adminListCatalog, adminSaveEndpoint, adminSaveModel, getDb } from '@vigas/db';
import { adminErrorResponse, requireAdmin } from '@/lib/admin';
import { reloadGatewayPools } from '@/lib/admin-gateway';
import { apiError, privateJson } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  try {
    const models = await adminListCatalog(getDb());
    return privateJson({ models });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: { kind?: 'model' | 'endpoint'; [k: string]: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  try {
    const result =
      body.kind === 'endpoint'
        ? await adminSaveEndpoint(getDb(), body as never)
        : await adminSaveModel(getDb(), body as never);
    revalidateTag('models', { expire: 0 });
    const reload = await reloadGatewayPools();
    return privateJson({ ...result, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const url = new URL(req.url);
  const modelId = url.searchParams.get('modelId')?.trim();
  const provider = url.searchParams.get('provider')?.trim();
  if (!modelId) return apiError(400, 'invalid_input', 'Query parameter "modelId" is required.');
  try {
    if (provider) await adminDeleteEndpoint(getDb(), provider, modelId);
    else await adminDeleteModel(getDb(), modelId);
    revalidateTag('models', { expire: 0 });
    const reload = await reloadGatewayPools();
    return privateJson({ ok: true, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
