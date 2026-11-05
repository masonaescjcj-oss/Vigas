import { adminSaveTool, getDb } from '@vigas/db';
import { adminErrorResponse, refreshContent, requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';

/** Create or update a tool by slug. Body: ToolInput from @vigas/core. */
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
    const { slug } = await adminSaveTool(getDb(), body as never);
    refreshContent('tools', [slug]);
    return privateJson({ slug });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
