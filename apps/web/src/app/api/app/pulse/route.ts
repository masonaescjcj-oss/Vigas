import type { NextRequest } from 'next/server';
import { pulseDraftSchema, sortPulse, type PulseFeedResponse, type PulsePostKind, type PulseSort } from '@vigas/core';
import { getRequestAuth } from '@/lib/auth';
import { apiError, privateJson, rateLimit, readJson, requireAuth } from '@/lib/http';
import { createPulse, listPulse } from '@/lib/pulse-store';

const KINDS: readonly PulsePostKind[] = ['prompt', 'battle', 'design'];

/** GET /api/app/pulse?kind=battle&sort=hot — the community feed. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = (sp.get('kind') || null) as PulsePostKind | null;
  if (kind && !KINDS.includes(kind)) return apiError(400, 'invalid_request', 'kind must be one of: prompt, battle, design.');
  const sort = (sp.get('sort') || 'hot') as PulseSort;
  if (sort !== 'hot' && sort !== 'new') return apiError(400, 'invalid_request', 'sort must be hot or new.');

  const auth = await getRequestAuth(req);
  const items = sortPulse(listPulse(auth?.user.id ?? null), sort).filter((p) => !kind || p.kind === kind);
  const body: PulseFeedResponse = { items: items.slice(0, 100), preview: true };
  return privateJson(body);
}

/** POST /api/app/pulse — share a prompt, battle or design comparison. */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const limited = rateLimit(`pulse:post:${auth.user.id}`, 6, 60_000);
  if (limited) return limited;
  const body = await readJson(req, pulseDraftSchema);
  if (!body.ok) return body.res;

  const handle = `builder_${auth.user.id.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase() || 'vigas'}`;
  const post = createPulse(body.data, { id: auth.user.id, name: 'Vigas builder', handle });
  if ('error' in post) return apiError(400, 'invalid_request', post.error);
  return privateJson(post, { status: 201 });
}
