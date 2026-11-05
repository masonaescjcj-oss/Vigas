import { z } from 'zod';
import type { ArenaVoteResponse } from '@vigas/core';
import { getBattle, getDb, getModel, voteBattle } from '@vigas/db';
import { apiError, privateJson, readJson, requireAuth } from '@/lib/http';

const schema = z.object({ vote: z.enum(['a', 'b', 'tie', 'bad']) });

export async function POST(req: Request, ctx: RouteContext<'/api/app/arena/[id]/vote'>) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const { id } = await ctx.params;

  const db = getDb();
  const battle = id.length <= 100 ? await getBattle(db, id) : null;
  // Same answer for "missing" and "someone else's", so battle ids cannot be probed.
  if (!battle || battle.userId !== auth.user.id) return apiError(404, 'not_found', 'Battle not found.');
  if (battle.vote) return apiError(409, 'already_voted', 'You already voted on this battle.');

  const row = await voteBattle(db, id, auth.user.id, body.data.vote);
  if (!row) return apiError(404, 'not_found', 'Battle not found.');
  const [ma, mb] = await Promise.all([getModel(db, row.modelA), getModel(db, row.modelB)]);
  const payload: ArenaVoteResponse = {
    battleId: row.id,
    vote: body.data.vote,
    sides: [
      { label: 'A', content: row.responseA, modelId: row.modelA, modelName: ma?.name ?? row.modelA },
      { label: 'B', content: row.responseB, modelId: row.modelB, modelName: mb?.name ?? row.modelB },
    ],
  };
  return privateJson(payload);
}
