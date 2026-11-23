import { usdToMicros } from '../money';
import type { ModelInfo, ModelTag, ProviderEndpoint } from '../models';
import { buildSevenApiExtraModels, sevenApiEndpoints } from './providers/sevenapi';
import { youComEndpoints, youComModels } from './providers/youcom';

/**
 * Production model catalogue synchronized with verified November 2026 Arena rankings and gateway pricing.
 * `upstreamModel` maps each catalog ID to the provider's model slug.
 */
type Row = [
  id: string,
  name: string,
  org: string,
  ctx: number,
  inUsd: number,
  outUsd: number,
  tags: ModelTag[],
  change: number,
  auto: boolean,
  provider: string,
  upstream: string,
];

const ROWS: Row[] = [
  ['anthropic/claude-fable-5.2', 'Claude Fable 5.2', 'Anthropic', 1_000_000, 1.8, 9, ['agents', 'coding'], 0, true, 'anthropic', 'claude-fable-5-2'],
  ['anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'Anthropic', 1_000_000, 15, 75, ['agents', 'coding'], 0, true, 'anthropic', 'claude-opus-5-5'],
  ['google/gemini-4-carbon', 'Gemini 4 Carbon', 'Google', 1_000_000, 2.0, 10, ['agents', 'vision'], -20, true, 'google', 'gemini-4-carbon'],
  ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5', 'Anthropic', 1_000_000, 3, 15, ['coding', 'agents'], 0, true, 'anthropic', 'claude-sonnet-5-5'],
  ['google/gemini-4-hydrogen', 'Gemini 4 Hydrogen', 'Google', 1_000_000, 0.5, 2.5, ['agents', 'reasoning'], -11.5, true, 'google', 'gemini-4-hydrogen'],
  ['anthropic/claude-fable-5.1', 'Claude Fable 5.1', 'Anthropic', 1_000_000, 0.8, 4, ['agents'], 0, true, 'anthropic', 'claude-fable-5-1'],
  ['openai/gpt-6-astra', 'GPT-6 Astra', 'OpenAI', 1_000_000, 5, 40, ['agents', 'reasoning'], 0, true, 'openai', 'gpt-6-astra'],
  ['openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'OpenAI', 1_000_000, 4, 32, ['reasoning'], 0, false, 'openai', 'gpt-6.1-sol'],
  ['openai/gpt-6.1-terra', 'GPT-6.1 Terra', 'OpenAI', 400_000, 0.6, 4.8, ['reasoning', 'coding'], -12.5, true, 'openai', 'gpt-6.1-terra'],
  ['google/gemini-4-argon', 'Gemini 4 Argon', 'Google', 1_000_000, 0.3, 2.5, ['vision'], -15, true, 'google', 'gemini-4-argon'],
  ['openai/gpt-6-luna', 'GPT-6 Luna', 'OpenAI', 400_000, 0.25, 1.2, ['reasoning'], -6.2, true, 'openai', 'gpt-6-luna'],
  ['qwen/qwen-3.8-max', 'Qwen 3.8 Max', 'Alibaba', 256_000, 0.4, 1.6, ['coding', 'vision'], -8.0, false, 'alibaba', 'qwen3.8-max'],
  ['zai/glm-5.3', 'GLM-5.3', 'Z.ai', 200_000, 0.35, 1.4, ['coding', 'reasoning'], -4.5, false, 'zai', 'glm-5.3'],
  ['meta/muse-wonder-full', 'Muse Wonder Full', 'Meta', 512_000, 0.9, 3.6, ['agents'], 0, false, 'together', 'meta/muse-wonder-full'],
  ['meta/muse-spark', 'Muse Spark', 'Meta', 512_000, 0.35, 1.4, ['vision', 'agents'], 0, false, 'together', 'meta/muse-spark'],
  ['meta/muse-ember', 'Muse Ember', 'Meta', 512_000, 0.12, 0.45, ['agents'], -9.0, false, 'together', 'meta/muse-ember'],
  ['xai/grok-4.7', 'Grok 4.7', 'xAI', 512_000, 2.0, 10.0, ['reasoning', 'agents'], 0, false, 'xai', 'grok-4-7'],
  ['anthropic/claude-opus-4.7', 'Claude Opus 4.7', 'Anthropic', 1_000_000, 10, 50, ['vision', 'coding'], -14, false, 'anthropic', 'claude-opus-4-7'],
  ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'Moonshot', 256_000, 0.6, 2.5, ['coding'], -4.1, false, 'moonshot', 'kimi-k3.1-pro'],
  ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 160_000, 0.07, 0.28, ['reasoning', 'coding'], -22, true, 'deepseek', 'deepseek-v4.1-flash'],
  ['xiaomi/mimo-v2.6-pro', 'MiMo-V2.6-Pro', 'Xiaomi', 128_000, 0.2, 0.8, ['coding'], 0, false, 'xiaomi', 'mimo-v2.6-pro'],
  ['nvidia/nemotron-3.5-super', 'Nemotron 3.5 Super', 'NVIDIA', 128_000, 0, 0, ['free'], 0, false, 'nvidia', 'nemotron-3.5-super'],
  ['openai/gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst', 'OpenAI', 128_000, 2.5, 10, ['vision'], 0, false, 'openai', 'gpt-image-2.5-sunburst'],
  ['openai/gpt-image-2.5-flare', 'GPT Image 2.5 Flare', 'OpenAI', 128_000, 1.5, 6, ['vision'], 0, false, 'openai', 'gpt-image-2.5-flare'],
  ['google/gemini-nano-banana-2.1', 'Gemini Nano Banana 2.1', 'Google', 128_000, 0.6, 2.4, ['vision'], 0, false, 'google', 'gemini-nano-banana-2.1'],
];

const BASE_MODELS: ModelInfo[] = ROWS.map(([id, name, org, ctx, i, o, tags, change, auto]) => ({
  id,
  name,
  org,
  contextLength: ctx,
  inputPerMillionMicros: usdToMicros(i),
  outputPerMillionMicros: usdToMicros(o),
  tags,
  priceChange24h: change,
  auto,
}));

const BASE_IDS = new Set(BASE_MODELS.map((m) => m.id));

export const seedModels: ModelInfo[] = [...BASE_MODELS, ...buildSevenApiExtraModels(BASE_IDS), ...youComModels];

const BASE_ENDPOINTS: ProviderEndpoint[] = [
  ...ROWS.map<ProviderEndpoint>(([id, , , , i, o, , , , provider, upstream]) => ({
    modelId: id,
    provider,
    upstreamModel: upstream,
    inputPerMillionMicros: usdToMicros(i),
    outputPerMillionMicros: usdToMicros(o),
    priority: 0,
    enabled: true,
  })),
  // A second host for DeepSeek Flash so requests can fall back when the first is rate-limited.
  {
    modelId: 'deepseek/v4.1-flash',
    provider: 'together',
    upstreamModel: 'deepseek-ai/DeepSeek-V4.1-Flash',
    inputPerMillionMicros: usdToMicros(0.09),
    outputPerMillionMicros: usdToMicros(0.35),
    priority: 1,
    enabled: true,
  },
];

export const seedEndpoints: ProviderEndpoint[] = [...BASE_ENDPOINTS, ...sevenApiEndpoints, ...youComEndpoints];
