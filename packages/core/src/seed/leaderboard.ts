import type { LeaderboardCategory, LeaderboardEntry } from '../app-api';
import { usdToMicros } from '../money';
import { seededRandom } from '../ranking';

/** Leaderboard snapshot from the v2 design prototype, used until real Arena votes accumulate. */
const BASE: Array<[modelId: string, name: string, org: string, winRate: number, rating: number, costUsd: number, kVotes: number]> = [
  ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 20.04, 1489, 6.82, 412],
  ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 16.56, 1471, 1.73, 388],
  ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (Max)', 'Anthropic', 14.62, 1462, 0.96, 351],
  ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 13.66, 1458, 4.1, 330],
  ['anthropic/claude-fable-5.1', 'Claude Fable 5.1 (Max)', 'Anthropic', 13.15, 1451, 0.61, 302],
  ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 12.24, 1447, 2.85, 296],
  ['google/gemini-4-argon', 'Gemini 4 Argon (High)', 'Google', 10.61, 1436, 0.74, 281],
  ['openai/gpt-6.1-terra', 'GPT-6.1 Terra (Max)', 'OpenAI', 10.19, 1431, 0.52, 265],
  ['meta/muse-wonder-full', 'Muse Wonder Full (Max)', 'Meta', 9.63, 1424, 0.88, 240],
  ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'Moonshot', 7.12, 1405, 0.31, 198],
  ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 6.4, 1393, 0.12, 187],
  ['xiaomi/mimo-v2.6-pro', 'MiMo-V2.6-Pro', 'Xiaomi', 5.85, 1381, 0.22, 164],
  ['nvidia/nemotron-3.5-super', 'Nemotron 3.5 Super', 'NVIDIA', 5.1, 1370, 0.18, 150],
];

export const SEED_TOTAL_SESSIONS = 373_440_550;

function trend(seed: number, end: number): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  let v = end * (0.85 + rand() * 0.2);
  for (let k = 0; k < 7; k++) {
    out.push(Number(v.toFixed(2)));
    v = Math.max(1, v + (rand() - 0.45) * end * 0.08);
  }
  out.push(end);
  return out;
}

/** Deterministic per-category variation of the base board, like the prototype's tabs. */
export function seedLeaderboard(category: LeaderboardCategory): LeaderboardEntry[] {
  const order: LeaderboardCategory[] = ['overall', 'coding', 'webdev', 'text', 'vision', 'image-edit', 'aligned', 'work'];
  const k = order.indexOf(category);
  const rand = seededRandom(k + 5);
  const rows = BASE.map(([modelId, name, org, winRate, rating, costUsd, kVotes], i) => {
    const f = k === 0 ? 1 : 0.7 + rand() * 0.6;
    const wr = Number((winRate * f).toFixed(2));
    return {
      rank: 0,
      modelId,
      name,
      org,
      winRate: wr,
      rating: Math.round(rating + (k === 0 ? 0 : (f - 1) * 60)),
      ci: 4 + (i % 4),
      costPerTaskMicros: usdToMicros(costUsd),
      votes: kVotes * 1000 + ((i * 733) % 1000),
      trend: trend(i * 31 + k + 1, wr),
    } satisfies LeaderboardEntry;
  });
  return rows.sort((a, b) => b.winRate - a.winRate).map((r, i) => ({ ...r, rank: i + 1 }));
}
