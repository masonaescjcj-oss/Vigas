import { desc, gte } from 'drizzle-orm';
import type { Db } from './client';
import { usageEvents } from './schema';

/** One recent request, anonymized for public display (no account, key or prompt data). */
export interface RecentSession {
  modelId: string;
  source: 'api' | 'chat' | 'arena' | 'retrobuild';
  status: 'ok' | 'error';
  latencyMs: number;
  createdAt: string;
}

/**
 * Latest requests across all accounts, for the leaderboard's "Live sessions" block on the website.
 * Only the model, product surface, outcome and timing are returned.
 */
export async function listRecentSessions(
  db: Db,
  opts: { limit?: number; sinceMs?: number } = {},
): Promise<RecentSession[]> {
  const since = new Date(Date.now() - (opts.sinceMs ?? 24 * 3_600_000));
  const rows = await db
    .select({
      modelId: usageEvents.modelId,
      source: usageEvents.source,
      status: usageEvents.status,
      latencyMs: usageEvents.latencyMs,
      createdAt: usageEvents.createdAt,
    })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since))
    .orderBy(desc(usageEvents.createdAt))
    .limit(Math.min(opts.limit ?? 6, 50));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
