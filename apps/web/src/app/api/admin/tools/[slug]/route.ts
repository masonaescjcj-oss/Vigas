import { adminDeleteTool, getDb } from '@vigas/db';
import { refreshContent, requireAdmin } from '@/lib/admin';
import { apiError, privateJson } from '@/lib/http';

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  if (!(await adminDeleteTool(getDb(), slug))) return apiError(404, 'not_found', 'Tool not found.');
  refreshContent('tools', [slug]);
  return privateJson({ ok: true });
}
