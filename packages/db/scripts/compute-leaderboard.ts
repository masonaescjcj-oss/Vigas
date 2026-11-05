/**
 * Recomputes leaderboard snapshots from Arena votes (Bradley–Terry with bootstrap intervals).
 * A category keeps its current snapshot until it has LEADERBOARD_MIN_VOTES voted battles.
 * Run on a schedule, e.g. every 15 minutes.
 */
import { bradleyTerryWithIntervals, LEADERBOARD_CATEGORIES, type LeaderboardEntry } from '@vigas/core';
import { createDb } from '../src/client';
import { listModels } from '../src/catalog';
import { getLeaderboard, listBattleOutcomes, replaceLeaderboard } from '../src/leaderboard';

const MIN_VOTES = Number(process.env.LEADERBOARD_MIN_VOTES ?? 200);
const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas', { max: 2 });
const catalog = new Map((await listModels(db)).map((m) => [m.id, m]));

for (const { id: category } of LEADERBOARD_CATEGORIES) {
  const battles = await listBattleOutcomes(db, category);
  if (battles.length < MIN_VOTES) {
    console.log(`${category}: ${battles.length} votes (< ${MIN_VOTES}), keeping current snapshot`);
    continue;
  }
  const previous = await getLeaderboard(db, category);
  const prevById = new Map(previous.entries.map((e) => [e.modelId, e]));
  const ratings = bradleyTerryWithIntervals(battles, { rounds: 100 });
  const entries: LeaderboardEntry[] = ratings
    .filter((r) => catalog.has(r.model))
    .map((r, i) => {
      const m = catalog.get(r.model)!;
      const prev = prevById.get(r.model);
      // Typical agent task: ~30K tokens in, ~4K out, until per-task cost is measured from sessions.
      const estCost = Math.ceil((30_000 * m.inputPerMillionMicros + 4_000 * m.outputPerMillionMicros) / 1_000_000);
      const winRate = Number(r.winRate.toFixed(2));
      return {
        rank: i + 1,
        modelId: r.model,
        name: prev?.name ?? m.name,
        org: m.org,
        winRate,
        rating: Math.round(r.rating),
        ci: Math.round(r.ci),
        costPerTaskMicros: prev?.costPerTaskMicros ?? estCost,
        votes: r.battles,
        trend: [...(prev?.trend ?? []).slice(-7), winRate],
      };
    });
  await replaceLeaderboard(db, category, entries, Math.max(previous.totalSessions, battles.length));
  console.log(`${category}: ranked ${entries.length} models from ${battles.length} votes`);
}
await close();
