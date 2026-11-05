import { usdToMicros } from '../money';
import type { ModelInfo, ModelTag, ProviderEndpoint } from '../models';

/**
 * Starting catalogue, taken from the v2 design prototype.
 * `upstreamModel` values are placeholders: set each one to the provider's real model ID before
 * enabling that provider in production.
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
  ['anthropic/claude-opus-5.5', 'Claude Opus 5.5', 'Anthropic', 1_000_000, 15, 75, ['agents', 'coding'], 0, true, 'anthropic', 'claude-opus-5-5'],
  ['google/gemini-4-carbon', 'Gemini 4 Carbon', 'Google', 2_000_000, 2.5, 15, ['agents', 'vision'], -8.2, true, 'google', 'gemini-4-carbon'],
  ['openai/gpt-6-astra', 'GPT-6 Astra', 'OpenAI', 1_000_000, 5, 40, ['agents', 'reasoning'], 0, true, 'openai', 'gpt-6-astra'],
  ['anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5', 'Anthropic', 1_000_000, 3, 15, ['coding', 'agents'], 0, true, 'anthropic', 'claude-sonnet-5-5'],
  ['anthropic/claude-fable-5.1', 'Claude Fable 5.1', 'Anthropic', 1_000_000, 0.8, 4, ['agents'], 0, true, 'anthropic', 'claude-fable-5-1'],
  ['openai/gpt-6.1-sol', 'GPT-6.1 Sol', 'OpenAI', 1_000_000, 4, 32, ['reasoning'], 0, false, 'openai', 'gpt-6.1-sol'],
  ['openai/gpt-6.1-terra', 'GPT-6.1 Terra', 'OpenAI', 400_000, 0.6, 4.8, ['reasoning'], -12.5, true, 'openai', 'gpt-6.1-terra'],
  ['google/gemini-4-argon', 'Gemini 4 Argon', 'Google', 1_000_000, 0.3, 2.5, ['vision'], -15, true, 'google', 'gemini-4-argon'],
  ['meta/muse-wonder-full', 'Muse Wonder Full', 'Meta', 512_000, 0.9, 3.6, ['agents'], 0, false, 'together', 'meta/muse-wonder-full'],
  ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'Moonshot', 256_000, 0.6, 2.5, ['coding'], -4.1, false, 'moonshot', 'kimi-k3.1-pro'],
  ['deepseek/v4.1-flash', 'DeepSeek V4.1 Flash', 'DeepSeek', 160_000, 0.07, 0.28, ['reasoning'], -22, true, 'deepseek', 'deepseek-v4.1-flash'],
  ['xiaomi/mimo-v2.6-pro', 'MiMo-V2.6-Pro', 'Xiaomi', 128_000, 0.2, 0.8, ['coding'], 0, false, 'xiaomi', 'mimo-v2.6-pro'],
  ['nvidia/nemotron-3.5-super', 'Nemotron 3.5 Super', 'NVIDIA', 128_000, 0, 0, ['free'], 0, false, 'nvidia', 'nemotron-3.5-super'],
];

export const seedModels: ModelInfo[] = ROWS.map(([id, name, org, ctx, i, o, tags, change, auto]) => ({
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

export const seedEndpoints: ProviderEndpoint[] = [
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
