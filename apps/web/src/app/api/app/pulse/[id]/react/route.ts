import { pulseReactionSchema, type PulseReactionResponse } from '@vigas/core';
import { getRequestAuth } from '@/lib/auth';
import { apiError, clientIp, originMismatch, privateJson, rateLimit, readJson } from '@/lib/http';
import { reactPulse } from '@/lib/pulse-store';

/**
 * POST /api/app/pulse/:id/react  `{ action: 'like' | 'unlike' }` or `{ action: 'vote', side: 'a' | 'b' }`.
 * Guests may react too (counted once per IP) so the feed stays open without a sign-in wall.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const bad = originMismatch(req);
  if (bad) return bad;
  const { id } = await ctx.params;
  if (!/^p_[a-z0-9_]{1,40}$/i.test(id)) return apiError(404, 'not_found', 'Post not found.');

  const auth = await getRequestAuth(req);
  const viewer = auth ? `u:${auth.user.id}` : `ip:${clientIp(req)}`;
  const limited = rateLimit(`pulse:react:${viewer}`, 60, 60_000);
  if (limited) return limited;
  const body = await readJson(req, pulseReactionSchema);
  if (!body.ok) return body.res;

  const post = reactPulse(id, viewer, body.data);
  if (!post) return apiError(404, 'not_found', 'Post not found.');
  const res: PulseReactionResponse = {
    id: post.id,
    likes: post.likes,
    liked: !!post.liked,
    voted: post.voted ?? null,
    votes: post.sides ? [post.sides[0].votes, post.sides[1].votes] : null,
  };
  return privateJson(res);
}
