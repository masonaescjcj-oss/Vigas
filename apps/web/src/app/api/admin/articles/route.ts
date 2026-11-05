import { adminSaveArticle, getDb } from '@vigas/db';
import { adminErrorResponse, refreshContent, requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';

/** Create an article (draft or published). Body: ArticleInput from @vigas/core. */
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
    const { slug } = await adminSaveArticle(getDb(), body as never);
    refreshContent('news', [slug]);
    return privateJson({ slug }, { status: 201 });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
