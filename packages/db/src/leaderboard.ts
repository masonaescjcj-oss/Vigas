import { and, asc, count, eq, gte, isNotNull, ne } from 'drizzle-orm';
import type { ArenaVote, Battle, LeaderboardCategory, LeaderboardEntry, LeaderboardResponse } from '@vigas/core';
import { randomId } from '@vigas/core/server';
import type { Db } from './client';
import { arenaBattles, leaderboardEntries, leaderboardMeta } from './schema';

export async function getLeaderboard(db: Db, category: LeaderboardCategory): Promise<LeaderboardResponse> {
  const rows = await db
    .select()
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.category, category))
    .orderBy(asc(leaderboardEntries.rank));
  const [meta] = await db.select().from(leaderboardMeta).where(eq(leaderboardMeta.category, category)).limit(1);
  return {
    category,
    updatedAt: (meta?.updatedAt ?? rows[0]?.updatedAt ?? new Date()).toISOString(),
    totalSessions: meta?.totalSessions ?? 0,
    entries: rows.map((r) => ({
      rank: r.rank,
      modelId: r.modelId,
      name: r.name,
      org: r.org,
      winRate: r.winRate,
      rating: r.rating,
      ci: r.ci,
      costPerTaskMicros: r.costPerTaskMicros,
      votes: r.votes,
      trend: r.trend,
    })),
  };
}

/** Replaces a category's snapshot. */
export async function replaceLeaderboard(
  db: Db,
  category: LeaderboardCategory,
  entries: LeaderboardEntry[],
  totalSessions: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(leaderboardEntries).where(eq(leaderboardEntries.category, category));
    if (entries.length) {
      await tx.insert(leaderboardEntries).values(
        entries.map((e) => ({
          category,
          modelId: e.modelId,
          rank: e.rank,
          name: e.name,
          org: e.org,
          winRate: e.winRate,
          rating: e.rating,
          ci: e.ci,
          costPerTaskMicros: e.costPerTaskMicros,
          votes: e.votes,
          trend: e.trend,
        })),
      );
    }
    await tx
      .insert(leaderboardMeta)
      .values({ category, totalSessions, updatedAt: new Date() })
      .onConflictDoUpdate({ target: leaderboardMeta.category, set: { totalSessions, updatedAt: new Date() } });
  });
}

// ── Arena ───────────────────────────────────────────────────────────────────

export async function createBattle(
  db: Db,
  input: { userId: string; category?: string; prompt: string; modelA: string; modelB: string; responseA: string; responseB: string },
): Promise<string> {
  const id = randomId('bat');
  await db.insert(arenaBattles).values({ id, category: input.category ?? 'overall', ...input });
  return id;
}

export async function getBattle(db: Db, id: string) {
  const [row] = await db.select().from(arenaBattles).where(eq(arenaBattles.id, id)).limit(1);
  return row ?? null;
}

/** Records a vote once, only by the user who ran the battle. */
export async function voteBattle(db: Db, id: string, userId: string, vote: ArenaVote) {
  const [row] = await db
    .update(arenaBattles)
    .set({ vote, votedAt: new Date() })
    .where(and(eq(arenaBattles.id, id), eq(arenaBattles.userId, userId)))
    .returning();
  return row ?? null;
}

export async function countBattlesSince(db: Db, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(arenaBattles)
    .where(and(eq(arenaBattles.userId, userId), gte(arenaBattles.createdAt, since)));
  return row?.n ?? 0;
}

/** Voted battles for the rating job. "Both bad" votes are skipped: they say nothing about order. */
export async function listBattleOutcomes(db: Db, category: string): Promise<Battle[]> {
  const rows = await db
    .select({ a: arenaBattles.modelA, b: arenaBattles.modelB, vote: arenaBattles.vote })
    .from(arenaBattles)
    .where(and(eq(arenaBattles.category, category), isNotNull(arenaBattles.vote), ne(arenaBattles.vote, 'bad')));
  return rows.map((r) => ({ a: r.a, b: r.b, outcome: r.vote as Battle['outcome'] }));
}
