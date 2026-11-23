import { adminGrantCredits, adminListUsers, adminSetUserRole, getDb } from '@vigas/db';
import { adminErrorResponse, requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const q = new URL(req.url).searchParams.get('q') ?? undefined;
  try {
    const users = await adminListUsers(getDb(), q);
    return privateJson({ users });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: {
    action?: 'credits' | 'role';
    accountId?: string;
    deltaUsd?: number;
    kind?: 'promo' | 'adjustment' | 'refund';
    reference?: string;
    userId?: string;
    role?: 'user' | 'admin';
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  try {
    if (body.action === 'role') {
      if (!body.userId || !body.role) return apiError(400, 'invalid_input', '"userId" and "role" are required.');
      if (body.userId === auth.user.id && body.role !== 'admin') {
        return apiError(400, 'cannot_demote_self', 'You cannot remove your own admin role.');
      }
      await adminSetUserRole(getDb(), body.userId, body.role);
      return privateJson({ ok: true });
    }
    if (!body.accountId) return apiError(400, 'invalid_input', '"accountId" is required.');
    const res = await adminGrantCredits(getDb(), {
      accountId: body.accountId,
      deltaUsd: Number(body.deltaUsd),
      kind: body.kind,
      reference: body.reference,
    });
    return privateJson(res);
  } catch (err) {
    return adminErrorResponse(err);
  }
}
