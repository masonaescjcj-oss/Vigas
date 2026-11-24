import { ensureVigasSchema, getDb, seedDatabase } from '@vigas/db';
import { requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';
import { PREVIEW_MODE } from '@/lib/preview';

export const maxDuration = 60;

/**
 * Idempotently bootstraps ONLY the isolated `"vigas"` Postgres schema (all 22 tables + indexes)
 * and seeds the model catalogue, authors, and tools without touching `"public"` or other schemas.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  if (PREVIEW_MODE) {
    return apiError(503, 'preview_mode', 'DATABASE_URL is not configured on this deployment.');
  }

  try {
    const db = getDb();
    await ensureVigasSchema(db);
    await seedDatabase(db, { demoUser: null, demoNews: false });
    return privateJson({ ok: true, schema: 'vigas' });
  } catch (err) {
    const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const code = e.code || e.cause?.code || 'db_error';
    const message = e.cause?.message || e.message || 'Database bootstrap failed.';
    return apiError(500, String(code), message);
  }
}
