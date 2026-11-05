import { revalidateTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { AdminInputError, type SessionUser } from '@vigas/db';
import { getCurrentUser, type RequestAuth } from './auth';
import { apiError, requireAuth } from './http';

/**
 * Admin access. Non-admins get a plain 404 so the admin area doesn't advertise itself.
 * Role is stored on users.role ('admin' | 'user').
 */
export async function requireAdmin(req: Request): Promise<RequestAuth | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== 'admin') return apiError(404, 'not_found', 'Not found.');
  return auth;
}

/** For request-time admin pages (inside <Suspense>). */
export async function getAdminUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') notFound();
  return user;
}

/** Makes edits visible right away on cached public pages. */
export function refreshContent(kind: 'news' | 'tools', slugs: Array<string | null | undefined>): void {
  revalidateTag(kind, { expire: 0 });
  for (const slug of slugs) {
    if (slug) revalidateTag(kind === 'news' ? `article:${slug}` : `tool:${slug}`, { expire: 0 });
  }
}

/** Turns validation errors from @vigas/db into a 400; rethrows anything else. */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminInputError) return apiError(400, 'invalid_input', err.message);
  throw err;
}
