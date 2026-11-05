import type { NextRequest } from 'next/server';
import { TOOL_CATEGORIES, type ToolCategory } from '@vigas/core';
import { getDb, listTools, type ToolSort } from '@vigas/db';
import { getRequestAuth } from '@/lib/auth';
import { getTools } from '@/lib/data';
import { apiError, privateJson, publicJson } from '@/lib/http';

const SORTS: readonly ToolSort[] = ['votes', 'rating', 'new'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = (sp.get('category') || null) as ToolCategory | null;
  if (category && !TOOL_CATEGORIES.includes(category)) {
    return apiError(400, 'invalid_request', `category must be one of: ${TOOL_CATEGORIES.join(', ')}.`);
  }
  const sort = (sp.get('sort') || 'votes') as ToolSort;
  if (!SORTS.includes(sort)) return apiError(400, 'invalid_request', 'sort must be one of: votes, rating, new.');
  const q = (sp.get('q') ?? '').trim().slice(0, 100) || null;

  const auth = await getRequestAuth(req);
  if (auth) {
    // Per-user `voted` flags: read live, never from the shared cache.
    const items = await listTools(getDb(), { category, q, sort, userId: auth.user.id });
    return privateJson({ items });
  }
  return publicJson({ items: await getTools({ category, q, sort }) });
}
