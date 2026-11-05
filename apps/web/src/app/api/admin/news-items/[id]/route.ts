import { z } from 'zod';
import { adminSaveAuthor, draftArticleFromItem, getDb, setNewsItemStatus } from '@vigas/db';
import { requireAdmin } from '@/lib/admin';
import { completeText, gatewayErrorResponse } from '@/lib/gateway';
import { apiError, privateJson, readJson } from '@/lib/http';

const bodySchema = z.object({ action: z.enum(['draft', 'ignore', 'restore']) });

/**
 * News inbox actions. "draft" asks a model (billed to the admin's account) for an original brief
 * and saves it as an unpublished draft; "ignore" hides the item; "restore" puts it back in the inbox.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return apiError(404, 'not_found', 'Item not found.');
  const parsed = await readJson(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const db = getDb();

  if (parsed.data.action !== 'draft') {
    await setNewsItemStatus(db, id, parsed.data.action === 'ignore' ? 'ignored' : 'new');
    return privateJson({ ok: true });
  }

  await adminSaveAuthor(db, { slug: 'vigas-newsroom', name: 'Vigas Newsroom', role: 'Newsroom (AI-assisted, editor reviewed)', color: '#FF6A1A' });
  try {
    const result = await draftArticleFromItem(
      db,
      id,
      (system, user) =>
        completeText(
          process.env.NEWS_DRAFT_MODEL ?? 'vigas/auto',
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          { accountId: auth.user.accountId, source: 'chat', maxTokens: 1200 },
        ),
      { authorSlug: 'vigas-newsroom' },
    );
    if ('error' in result) return apiError(422, 'draft_failed', result.error);
    return privateJson(result, { status: 201 });
  } catch (err) {
    return gatewayErrorResponse(err);
  }
}
