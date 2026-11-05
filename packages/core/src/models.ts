export type ModelTag = 'agents' | 'coding' | 'reasoning' | 'vision' | 'free';

export const MODEL_TAGS: readonly ModelTag[] = ['agents', 'coding', 'reasoning', 'vision', 'free'];

/** A model as listed in the public catalogue (`/v1/models`, the Models page). */
export interface ModelInfo {
  /** Public ID, e.g. "anthropic/claude-opus-5.5". */
  id: string;
  name: string;
  /** Model maker shown to users, e.g. "Anthropic". */
  org: string;
  contextLength: number;
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
  tags: ModelTag[];
  /** Price change over the last 24h in percent (negative = cheaper). */
  priceChange24h: number;
  /** Eligible for `vigas/auto` routing. */
  auto: boolean;
  description?: string;
}

/** One upstream that can serve a model. A model may have several (for fallback). */
export interface ProviderEndpoint {
  modelId: string;
  /** Provider slug, matches a gateway adapter config, e.g. "anthropic", "openai", "deepseek". */
  provider: string;
  /** Model name the provider expects, e.g. "claude-opus-5-5". */
  upstreamModel: string;
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
  /** Lower runs first among equally ranked endpoints. */
  priority: number;
  enabled: boolean;
}

export const AUTO_MODEL_ID = 'vigas/auto';

export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  return `${Math.round(tokens / 1000)}K`;
}
