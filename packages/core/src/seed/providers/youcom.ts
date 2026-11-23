import { usdToMicros } from '../../money';
import type { ModelInfo, ProviderEndpoint } from '../../models';

/**
 * You.com Agents API upstream pool (`https://api.you.com/v1/agents/runs`).
 *
 * Vigas serves You.com models through pooled promotional / enterprise API keys
 * with automatic rotation (`YOU_API_KEYS`, `YOU_KEY_STRATEGY`, `YOU_KEY_BUDGET_USD`).
 * New users receive a $5.00 welcome credit usable on `you/*` models immediately upon signup.
 */
export const YOUCOM_PROVIDER_SLUG = 'you';
export const YOUCOM_DEFAULT_BASE_URL = 'https://api.you.com';
export const YOUCOM_PUBLIC_LABEL = 'vigas-edge';

export interface YouComModelSpec {
  /** Public Vigas model id (e.g. `you/express`). */
  id: string;
  /** Display name in catalog, API list, and chat. */
  name: string;
  /** Agent identifier sent to `POST /v1/agents/runs`. */
  agent: 'express' | 'advanced' | 'research';
  /** Context window in tokens. */
  contextLength: number;
  /** Retail input price in USD per 1M tokens (billed against user balance / welcome credit). */
  retailInputUsd: number;
  /** Retail output price in USD per 1M tokens. */
  retailOutputUsd: number;
  tags: ModelInfo['tags'];
}

export const YOUCOM_CATALOG: readonly YouComModelSpec[] = [
  {
    id: 'you/express',
    name: 'You Express Search',
    agent: 'express',
    contextLength: 128_000,
    retailInputUsd: 0.2,
    retailOutputUsd: 0.2,
    tags: ['agents'],
  },
  {
    id: 'you/advanced',
    name: 'You Advanced Search',
    agent: 'advanced',
    contextLength: 128_000,
    retailInputUsd: 0.4,
    retailOutputUsd: 0.4,
    tags: ['agents', 'reasoning'],
  },
  {
    id: 'you/research',
    name: 'You Deep Research',
    agent: 'research',
    contextLength: 128_000,
    retailInputUsd: 0.6,
    retailOutputUsd: 0.6,
    tags: ['agents', 'reasoning'],
  },
];

export const youComModels: ModelInfo[] = YOUCOM_CATALOG.map((m) => ({
  id: m.id,
  name: m.name,
  org: 'You.com',
  contextLength: m.contextLength,
  inputPerMillionMicros: usdToMicros(m.retailInputUsd),
  outputPerMillionMicros: usdToMicros(m.retailOutputUsd),
  tags: m.tags,
  priceChange24h: 0,
  auto: false,
}));

export const youComEndpoints: ProviderEndpoint[] = YOUCOM_CATALOG.map((m) => ({
  modelId: m.id,
  provider: YOUCOM_PROVIDER_SLUG,
  upstreamModel: m.agent,
  // Wholesale cost is covered by pooled promo/credit keys; retail billing happens at ModelInfo rate.
  inputPerMillionMicros: 0,
  outputPerMillionMicros: 0,
  priority: 0,
  enabled: true,
}));
