import type { ModelInfo, ProviderEndpoint } from '../../models';

/**
 * Official Google Gemini Developer API (`https://generativelanguage.googleapis.com/v1beta/openai`).
 *
 * Vigas runs pooled Google AI Studio Free Tier keys (`GOOGLE_API_KEYS` / `GEMINI_API_KEYS`)
 * dedicated exclusively to **Gemini 4 Hydrogen** (`google/gemini-4-hydrogen` and
 * `google/gemini-4-hydrogen:free`), while paid-only Gemini models (`gemini-4-carbon`,
 * `gemini-4-neon`, `gemini-4-argon`) route through paid upstream pools like `sevenapi`.
 */
export const GOOGLE_PROVIDER_SLUG = 'google';
export const GOOGLE_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

/** Default model allowlist applied when real Free-Tier `GOOGLE_API_KEYS` are configured. */
export const GOOGLE_FREE_TIER_MODELS: readonly string[] = [
  'google/gemini-4-hydrogen',
  'google/gemini-4-hydrogen:free',
];

export interface GoogleModelSpec {
  id: string;
  name: string;
  upstreamModel: string;
  contextLength: number;
  inputUsd: number;
  outputUsd: number;
  tags: ModelInfo['tags'];
}

export const GOOGLE_EXTRA_CATALOG: readonly GoogleModelSpec[] = [
  // Free starter tier for Gemini 4 Hydrogen backed by pooled Google AI Studio Free Tier keys ($0/1M, RPM-limited).
  {
    id: 'google/gemini-4-hydrogen:free',
    name: 'Gemini 4 Hydrogen (Free)',
    upstreamModel: 'gemini-4-hydrogen',
    contextLength: 1_000_000,
    inputUsd: 0,
    outputUsd: 0,
    tags: ['free', 'agents', 'reasoning'],
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
      inputPerMillionMicros: 0,
      outputPerMillionMicros: 0,
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
  inputPerMillionMicros: 0,
  outputPerMillionMicros: 0,
  priority: 0,
  enabled: true,
}));
