import { adminAddUpstreamKeys, adminDeleteUpstreamKey, adminUpdateUpstreamKey, getDb } from '@vigas/db';
import { adminErrorResponse, requireAdmin } from '@/lib/admin';
import { reloadGatewayPools } from '@/lib/admin-gateway';
import { apiError, privateJson } from '@/lib/http';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: { providerSlug?: string; rawKeys?: string; labelPrefix?: string; budgetUsd?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  try {
    const result = await adminAddUpstreamKeys(getDb(), {
      providerSlug: body.providerSlug ?? '',
      rawKeys: body.rawKeys ?? '',
      labelPrefix: body.labelPrefix,
      budgetUsd: body.budgetUsd ?? null,
    });
    const reload = await reloadGatewayPools();
    return privateJson({ ...result, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: { id?: string; enabled?: boolean; label?: string; budgetUsd?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (!body.id) return apiError(400, 'invalid_input', '"id" is required.');
  try {
    await adminUpdateUpstreamKey(getDb(), body.id, {
      enabled: body.enabled,
      label: body.label,
      budgetUsd: body.budgetUsd,
    });
    const reload = await reloadGatewayPools();
    return privateJson({ ok: true, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const id = new URL(req.url).searchParams.get('id')?.trim();
  if (!id) return apiError(400, 'invalid_input', 'Query parameter "id" is required.');
  try {
    await adminDeleteUpstreamKey(getDb(), id);
    const reload = await reloadGatewayPools();
    return privateJson({ deleted: id, reload });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
