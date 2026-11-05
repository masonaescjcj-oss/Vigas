import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { ArenaBattleResponse } from '@vigas/core';
import { countBattlesSince, createBattle, getDb } from '@vigas/db';
import { getLeaderboardData } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { completeText, gatewayErrorResponse } from '@/lib/gateway';
import { apiError, privateJson, rateLimit, readJson, requireAuth } from '@/lib/http';

const schema = z.object({ prompt: z.string().trim().min(1, 'Write a prompt first.').max(4000, 'Prompts are at most 4,000 characters.') });

/** Upper bound on each Arena answer, since the platform may pay for battles. */
const ARENA_MAX_TOKENS = 1024;

const startOfUtcDay = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const limited = rateLimit(`arena:${auth.user.id}`, 10, 60_000);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;

  const env = serverEnv();
  const db = getDb();
  const used = await countBattlesSince(db, auth.user.id, startOfUtcDay());
  if (used >= env.arenaDailyLimit) {
    return apiError(429, 'arena_limit', `You have used all ${env.arenaDailyLimit} Arena battles for today. New battles unlock at 00:00 UTC.`);
  }

  const pool = [...new Set((await getLeaderboardData('overall')).entries.slice(0, 10).map((e) => e.modelId))];
  if (pool.length < 2) return apiError(503, 'arena_unavailable', 'Arena needs at least two ranked models.');
  const ia = randomInt(pool.length);
  let ib = randomInt(pool.length - 1);
  if (ib >= ia) ib += 1;
  const modelA = pool[ia]!;
  const modelB = pool[ib]!;

  const messages = [{ role: 'user' as const, content: body.data.prompt }];
  const opts = { accountId: env.arenaBillingAccountId ?? auth.user.accountId, source: 'arena' as const, maxTokens: ARENA_MAX_TOKENS };
  let responseA: string;
  let responseB: string;
  try {
    [responseA, responseB] = await Promise.all([completeText(modelA, messages, opts), completeText(modelB, messages, opts)]);
  } catch (err) {
    return gatewayErrorResponse(err);
  }

  const battleId = await createBattle(db, {
    userId: auth.user.id,
    category: 'overall',
    prompt: body.data.prompt,
    modelA,
    modelB,
    responseA,
    responseB,
  });
  const payload: ArenaBattleResponse = {
    battleId,
    prompt: body.data.prompt,
    sides: [
      { label: 'A', content: responseA },
      { label: 'B', content: responseB },
    ],
  };
  return privateJson(payload, { status: 201 });
}
