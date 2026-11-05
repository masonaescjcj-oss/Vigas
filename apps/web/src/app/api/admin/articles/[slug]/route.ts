import { adminDeleteArticle, adminSaveArticle, getDb } from '@vigas/db';
import { adminErrorResponse, refreshContent, requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';

type Ctx = { params: Promise<{ slug: string }> };

/** Update an article; the body may carry a new `slug` to rename it. */
export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  try {
    const saved = await adminSaveArticle(getDb(), body as never, slug);
    refreshContent('news', [slug, saved.slug]);
    return privateJson(saved);
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  if (!(await adminDeleteArticle(getDb(), slug))) return apiError(404, 'not_found', 'Article not found.');
  refreshContent('news', [slug]);
  return privateJson({ ok: true });
}
