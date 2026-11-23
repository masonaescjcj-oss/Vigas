import { usdToMicros } from '../../money';
import type { ModelInfo, ProviderEndpoint } from '../../models';

/**
 * Official Google Gemini Developer API (`https://generativelanguage.googleapis.com/v1beta/openai`).
 *
 * Designed for multi-key rotation (`GOOGLE_API_KEYS` / `GEMINI_API_KEYS`, `GOOGLE_KEY_STRATEGY`,
 * `GOOGLE_KEY_BUDGET_USD`) across both Free Tier and Paid Tier keys.
 *
 * Includes:
 * - Gemini 4 family (`gemini-4-carbon`, `gemini-4-neon`, `gemini-4-argon`, `gemini-4-hydrogen`)
 * - Gemini 3 family (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`)
 * - Gemini 2.5 family (`gemini-2.5-pro`, `gemini-2.5-flash-lite`)
 * - Dedicated `:free` starter aliases (`google/gemini-4-hydrogen:free`, `google/gemini-3.5-flash-lite:free`)
 *   powered by pooled Google AI Studio Free Tier keys.
 */
export const GOOGLE_PROVIDER_SLUG = 'google';
export const GOOGLE_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

export interface GoogleModelSpec {
  id: string;
  name: string;
  upstreamModel: string;
  contextLength: number;
  inputUsd: number;
  outputUsd: number;
  cachedInputUsd?: number;
  tags: ModelInfo['tags'];
  /** True if Google AI Studio serves this model on its Free Tier as well as Paid Tier. */
  freeTierSupported?: boolean;
}

export const GOOGLE_EXTRA_CATALOG: readonly GoogleModelSpec[] = [
  {
    id: 'google/gemini-4-neon',
    name: 'Gemini 4 Neon',
    upstreamModel: 'gemini-4-neon',
    contextLength: 1_000_000,
    inputUsd: 3.0,
    outputUsd: 15.0,
    cachedInputUsd: 0.15,
    tags: ['agents', 'coding', 'vision'],
  },
  {
    id: 'google/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    upstreamModel: 'gemini-3.8-flash',
    contextLength: 1_000_000,
    inputUsd: 1.5,
    outputUsd: 7.5,
    cachedInputUsd: 0.075,
    tags: ['coding', 'agents', 'vision'],
    freeTierSupported: true,
  },
  {
    id: 'google/gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    upstreamModel: 'gemini-3.6-flash',
    contextLength: 1_000_000,
    inputUsd: 1.5,
    outputUsd: 7.5,
    cachedInputUsd: 0.075,
    tags: ['coding', 'agents', 'vision'],
    freeTierSupported: true,
  },
  {
    id: 'google/gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    upstreamModel: 'gemini-3.5-flash-lite',
    contextLength: 1_000_000,
    inputUsd: 0.3,
    outputUsd: 2.5,
    cachedInputUsd: 0.03,
    tags: ['agents', 'vision'],
    freeTierSupported: true,
  },
  {
    id: 'google/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    upstreamModel: 'gemini-3.1-flash-lite',
    contextLength: 1_000_000,
    inputUsd: 0.25,
    outputUsd: 1.5,
    cachedInputUsd: 0.025,
    tags: ['agents', 'vision'],
    freeTierSupported: true,
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    upstreamModel: 'gemini-3.1-pro-preview',
    contextLength: 1_000_000,
    inputUsd: 2.0,
    outputUsd: 12.0,
    cachedInputUsd: 0.2,
    tags: ['coding', 'reasoning', 'vision'],
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    upstreamModel: 'gemini-2.5-pro',
    contextLength: 1_000_000,
    inputUsd: 1.25,
    outputUsd: 10.0,
    cachedInputUsd: 0.125,
    tags: ['coding', 'reasoning', 'vision'],
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    upstreamModel: 'gemini-2.5-flash-lite',
    contextLength: 1_000_000,
    inputUsd: 0.1,
    outputUsd: 0.4,
    cachedInputUsd: 0.01,
    tags: ['vision'],
    freeTierSupported: true,
  },
  // Community free-tier aliases backed by pooled Google AI Studio Free Tier keys ($0/1M, RPM-limited).
  {
    id: 'google/gemini-4-hydrogen:free',
    name: 'Gemini 4 Hydrogen (Free)',
    upstreamModel: 'gemini-4-hydrogen',
    contextLength: 1_000_000,
    inputUsd: 0,
    outputUsd: 0,
    tags: ['free', 'agents', 'reasoning'],
    freeTierSupported: true,
  },
  {
    id: 'google/gemini-3.5-flash-lite:free',
    name: 'Gemini 3.5 Flash-Lite (Free)',
    upstreamModel: 'gemini-3.5-flash-lite',
    contextLength: 1_000_000,
    inputUsd: 0,
    outputUsd: 0,
    tags: ['free', 'vision'],
    freeTierSupported: true,
  },
];

export function buildGoogleExtraModels(existingIds: ReadonlySet<string>): ModelInfo[] {
  const seen = new Set(existingIds);
  const out: ModelInfo[] = [];
  for (const m of GOOGLE_EXTRA_CATALOG) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({
      id: m.id,
      name: m.name,
      org: 'Google',
      contextLength: m.contextLength,
      inputPerMillionMicros: usdToMicros(m.inputUsd),
      outputPerMillionMicros: usdToMicros(m.outputUsd),
      ...(m.cachedInputUsd !== undefined ? { cachedInputPerMillionMicros: usdToMicros(m.cachedInputUsd) } : {}),
      tags: m.tags,
      priceChange24h: 0,
      auto: false,
    });
  }
  return out;
}

export const googleExtraEndpoints: ProviderEndpoint[] = GOOGLE_EXTRA_CATALOG.map((m) => ({
  modelId: m.id,
  provider: GOOGLE_PROVIDER_SLUG,
  upstreamModel: m.upstreamModel,
  inputPerMillionMicros: usdToMicros(m.inputUsd),
  outputPerMillionMicros: usdToMicros(m.outputUsd),
  ...(m.cachedInputUsd !== undefined ? { cachedInputPerMillionMicros: usdToMicros(m.cachedInputUsd) } : {}),
  priority: 0,
  enabled: true,
}));
