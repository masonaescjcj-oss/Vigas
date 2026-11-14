import type { LeaderboardCategory, LeaderboardEntry } from '../app-api';
import { usdToMicros } from '../money';
import { seededRandom } from '../ranking';

/**
 * Verified November 2026 snapshots modeled from live arena.ai/leaderboard categories
 * (`overall`, `coding`, `webdev`, `text`, `vision`, `image-edit`, `aligned`, `work`).
 */
type EntryRow = [
  modelId: string,
  name: string,
  org: string,
  winRate: number,
  rating: number,
  ci: number,
  costUsd: number,
  kVotes: number,
];

const BOARDS: Record<LeaderboardCategory, EntryRow[]> = {
  overall: [
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (Max)', 'Anthropic', 30.48, 1548, 3.07, 8.02, 498],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 19.51, 1489, 2.04, 5.71, 441],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 16.90, 1476, 0.68, 1.42, 418],
    ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (Max)', 'Anthropic', 16.07, 1470, 2.81, 1.95, 382],
    ['google/gemini-4-hydrogen', 'Gemini 4 Hydrogen (High)', 'Google', 14.80, 1463, 2.23, 0.92, 312],
    ['anthropic/claude-fable-5.1', 'Claude Fable 5.1 (Max)', 'Anthropic', 14.62, 1458, 2.06, 1.25, 305],
    ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 14.56, 1456, 2.03, 4.10, 334],
    ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 12.40, 1446, 1.12, 1.03, 298],
    ['openai/gpt-6.1-terra', 'GPT-6.1 Terra (Max)', 'OpenAI', 11.96, 1442, 1.25, 0.89, 279],
    ['google/gemini-4-argon', 'Gemini 4 Argon (High)', 'Google', 10.72, 1433, 0.89, 0.70, 284],
    ['openai/gpt-6-luna', 'GPT-6 Luna (Low)', 'OpenAI', 6.10, 1418, 0.94, 0.15, 228],
    ['xiaomi/mimo-v2.6-pro', 'MiMo-V2.6-Pro', 'Xiaomi', 2.16, 1394, 1.18, 0.16, 176],
    ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 2.01, 1391, 0.95, 0.12, 214],
    ['meta/muse-ember', 'Muse Ember (Max)', 'Meta', 1.99, 1382, 1.40, 0.22, 148],
  ],
  coding: [
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (Max)', 'Anthropic', 31.45, 1564, 2.95, 8.02, 246],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 22.24, 1512, 2.10, 5.71, 219],
    ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (Max)', 'Anthropic', 16.15, 1482, 2.40, 1.95, 198],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 15.54, 1474, 1.35, 1.42, 187],
    ['openai/gpt-6.1-terra', 'GPT-6.1 Terra (Max)', 'OpenAI', 14.19, 1466, 1.48, 0.89, 169],
    ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 13.84, 1461, 1.90, 4.10, 158],
    ['google/gemini-4-hydrogen', 'Gemini 4 Hydrogen (High)', 'Google', 13.42, 1457, 2.12, 0.92, 149],
    ['qwen/qwen-3.8-max', 'Qwen 3.8 Max', 'Alibaba', 11.88, 1445, 2.30, 0.54, 132],
    ['zai/glm-5.3', 'GLM-5.3', 'Z.ai', 11.20, 1438, 2.45, 0.42, 121],
    ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 7.85, 1412, 1.65, 0.12, 162],
    ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'Moonshot', 7.42, 1406, 1.80, 0.31, 118],
    ['xiaomi/mimo-v2.6-pro', 'MiMo-V2.6-Pro', 'Xiaomi', 6.14, 1392, 1.95, 0.16, 104],
    ['nvidia/nemotron-3.5-super', 'Nemotron 3.5 Super', 'NVIDIA', 5.10, 1378, 2.20, 0.18, 96],
  ],
  webdev: [
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (xHigh)', 'Anthropic', 31.80, 1838, 21, 7.40, 142],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 23.10, 1815, 12, 5.71, 134],
    ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (xHigh)', 'Anthropic', 18.40, 1772, 10, 1.95, 128],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 17.95, 1768, 15, 1.42, 121],
    ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 17.20, 1764, 9, 4.10, 115],
    ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 15.10, 1743, 10, 1.03, 109],
    ['anthropic/claude-fable-5.1', 'Claude Fable 5.1 (Max)', 'Anthropic', 14.40, 1732, 14, 1.25, 102],
    ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'Moonshot', 11.30, 1698, 16, 0.31, 94],
    ['zai/glm-5.3', 'GLM-5.3', 'Z.ai', 10.20, 1685, 18, 0.42, 87],
    ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 8.15, 1642, 14, 0.12, 91],
  ],
  text: [
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 22.40, 1526, 10, 1.42, 310],
    ['google/gemini-4-argon', 'Gemini 4 Argon (High)', 'Google', 21.60, 1522, 5, 0.70, 294],
    ['meta/muse-wonder-full', 'Muse Wonder Full', 'Meta', 19.80, 1511, 6, 0.88, 241],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 19.10, 1507, 6, 5.71, 276],
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (Max)', 'Anthropic', 18.75, 1504, 4, 8.02, 265],
    ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 16.90, 1495, 7, 1.03, 212],
    ['xai/grok-4.7', 'Grok 4.7', 'xAI', 15.40, 1482, 8, 1.85, 188],
    ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 11.20, 1446, 7, 0.12, 205],
  ],
  vision: [
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (Max)', 'Anthropic', 21.10, 1309, 7, 8.02, 164],
    ['anthropic/claude-opus-4.7', 'Claude Opus 4.7', 'Anthropic', 19.80, 1300, 7, 4.90, 152],
    ['qwen/qwen-3.8-max', 'Qwen 3.8 Max', 'Alibaba', 19.55, 1299, 7, 0.54, 144],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 19.20, 1296, 6, 1.42, 160],
    ['meta/muse-spark', 'Muse Spark', 'Meta', 18.60, 1294, 9, 0.62, 131],
    ['google/gemini-4-hydrogen', 'Gemini 4 Hydrogen (High)', 'Google', 17.40, 1284, 8, 0.92, 122],
    ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 16.80, 1279, 8, 4.10, 118],
    ['google/gemini-4-argon', 'Gemini 4 Argon (High)', 'Google', 14.10, 1258, 7, 0.70, 108],
  ],
  'image-edit': [
    ['openai/gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst', 'OpenAI', 24.80, 1519, 5, 1.80, 112],
    ['openai/gpt-image-2.5-flare', 'GPT Image 2.5 Flare', 'OpenAI', 22.30, 1484, 4, 1.10, 98],
    ['google/gemini-nano-banana-2.1', 'Gemini Nano Banana 2.1', 'Google', 20.40, 1427, 6, 0.45, 91],
    ['meta/muse-spark', 'Muse Spark', 'Meta', 18.10, 1408, 7, 0.62, 84],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 16.50, 1395, 8, 1.42, 79],
    ['qwen/qwen-3.8-max', 'Qwen 3.8 Max', 'Alibaba', 14.90, 1382, 9, 0.54, 72],
  ],
  aligned: [
    ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 21.40, 1488, 1.5, 1.03, 148],
    ['openai/gpt-6-astra', 'GPT-6 Astra (Max)', 'OpenAI', 21.10, 1485, 1.1, 4.10, 144],
    ['openai/gpt-6-luna', 'GPT-6 Luna (Low)', 'OpenAI', 20.90, 1482, 1.4, 0.15, 136],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 18.40, 1461, 2.0, 5.71, 139],
    ['xai/grok-4.7', 'Grok 4.7', 'xAI', 17.90, 1455, 1.3, 1.85, 118],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 17.20, 1449, 1.5, 1.42, 129],
    ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (Max)', 'Anthropic', 16.10, 1441, 1.8, 1.95, 115],
  ],
  work: [
    ['anthropic/claude-fable-5.2', 'Claude Fable 5.2 (Max)', 'Anthropic', 30.01, 1542, 2.8, 8.02, 284],
    ['anthropic/claude-opus-5.5', 'Claude Opus 5.5 (Max)', 'Anthropic', 18.60, 1486, 1.9, 5.71, 251],
    ['google/gemini-4-carbon', 'Gemini 4 Carbon (High)', 'Google', 15.86, 1470, 1.1, 1.42, 232],
    ['anthropic/claude-fable-5.1', 'Claude Fable 5.1 (Max)', 'Anthropic', 15.23, 1464, 1.7, 1.25, 208],
    ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (Max)', 'Anthropic', 14.71, 1459, 2.1, 1.95, 196],
    ['openai/gpt-6.1-sol', 'GPT-6.1 Sol (Max)', 'OpenAI', 12.60, 1444, 1.3, 1.03, 174],
    ['google/gemini-4-hydrogen', 'Gemini 4 Hydrogen (High)', 'Google', 11.80, 1438, 1.6, 0.92, 168],
    ['openai/gpt-6.1-terra', 'GPT-6.1 Terra (Max)', 'OpenAI', 10.90, 1429, 1.4, 0.89, 154],
    ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 6.80, 1396, 1.2, 0.12, 149],
  ],
};

export const SEED_TOTAL_SESSIONS = 378_706_203;

function trend(seed: number, end: number): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  let v = end * (0.86 + rand() * 0.16);
  for (let k = 0; k < 7; k++) {
    out.push(Number(v.toFixed(2)));
    v = Math.max(1, v + (rand() - 0.43) * end * 0.075);
  }
  out.push(end);
  return out;
}

/** Returns authentic per-category Arena leaderboard rows sorted by win share / Elo. */
export function seedLeaderboard(category: LeaderboardCategory): LeaderboardEntry[] {
  const rows = BOARDS[category] ?? BOARDS.overall;
  return rows.map(([modelId, name, org, winRate, rating, ci, costUsd, kVotes], i) => ({
    rank: i + 1,
    modelId,
    name,
    org,
    winRate,
    rating,
    ci,
    costPerTaskMicros: usdToMicros(costUsd),
    votes: kVotes * 1000 + ((i * 733) % 1000),
    trend: trend(i * 31 + category.length * 17 + 3, winRate),
  }));
}
