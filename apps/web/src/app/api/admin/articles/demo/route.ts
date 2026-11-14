import { adminDeleteDemoArticles, getDb } from '@vigas/db';
import { refreshContent, requireAdmin } from '@/lib/admin';
import { privateJson } from '@/lib/http';

/** Deletes prototype seeded articles from the database so launch stays clean. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const deleted = await adminDeleteDemoArticles(getDb());
  refreshContent('news', deleted);
  return privateJson({ deleted: deleted.length, slugs: deleted });
}
