import { requireAdmin } from '@/lib/admin';
import { privateJson } from '@/lib/http';
import { PREVIEW_MODE } from '@/lib/preview';

/**
 * Verifies whether the current caller (Postgres session cookie OR Supabase Auth Bearer JWT)
 * holds admin privileges, and reports whether Postgres `DATABASE_URL` is connected.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  return privateJson({
    ok: true,
    email: auth.user.email,
    role: auth.user.role,
    previewMode: PREVIEW_MODE,
  });
}
