import { costMicros, type TokenPrice } from './money';
import { AUTO_MODEL_ID, type ModelInfo, type ProviderEndpoint } from './models';

export type RouteSort = 'price' | 'latency' | 'quality';

export interface RouteOptions {
  /** How to order candidates. Default: "price" for explicit models, "quality" for vigas/auto. */
  sort?: RouteSort;
  /** Try other endpoints/models when one fails. Default true. */
  fallbacks?: boolean;
  /** Maximum attempts including the first. Default 3. */
  maxAttempts?: number;
}

export interface EndpointStats {
  /** Recent median latency in ms. */
  p50LatencyMs?: number;
  /** False while a circuit breaker is open for this endpoint. */
  healthy?: boolean;
}

export interface RouteCandidate {
  model: ModelInfo;
  endpoint: ProviderEndpoint;
  /** Arena rating used for "quality" sorting. */
  rating: number;
  latencyMs: number;
}

export interface PlanRouteInput {
  /** Requested model id, or "vigas/auto". */
  model: string;
  /** Extra fallback models in order (OpenRouter-style `models` array). */
  models?: string[];
  catalog: ModelInfo[];
  endpoints: ProviderEndpoint[];
  ratings?: Record<string, number>;
  stats?: Record<string, EndpointStats>;
  options?: RouteOptions;
}

export const endpointKey = (e: Pick<ProviderEndpoint, 'provider' | 'modelId'>) => `${e.provider}:${e.modelId}`;

/** Typical request shape used to compare prices: 3K tokens in, 500 out. */
const BLEND: { promptTokens: number; completionTokens: number } = { promptTokens: 3000, completionTokens: 500 };

export function blendedCost(price: TokenPrice): number {
  return costMicros(BLEND, price);
}

export class RouteError extends Error {
  constructor(
    message: string,
    readonly code: 'model_not_found' | 'no_available_endpoint',
  ) {
    super(message);
  }
}

/**
 * Orders every endpoint that may serve a request. The gateway tries them in order until one
 * succeeds. Unhealthy endpoints move to the end instead of being dropped, so a request still has
 * a chance when every provider is degraded.
 */
export function planRoute(input: PlanRouteInput): RouteCandidate[] {
  const { catalog, endpoints, ratings = {}, stats = {} } = input;
  const opts = input.options ?? {};
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const isAuto = input.model === AUTO_MODEL_ID;
  const sort: RouteSort = opts.sort ?? (isAuto ? 'quality' : 'price');

  const requested = isAuto ? catalog.filter((m) => m.auto).map((m) => m.id) : [input.model, ...(input.models ?? [])];
  for (const id of requested) {
    if (!isAuto && !byId.has(id)) throw new RouteError(`Model "${id}" does not exist`, 'model_not_found');
  }

  const toCandidates = (modelIds: string[]) =>
    endpoints
      .filter((e) => e.enabled && modelIds.includes(e.modelId))
      .map<RouteCandidate>((endpoint) => ({
        model: byId.get(endpoint.modelId)!,
        endpoint,
        rating: ratings[endpoint.modelId] ?? 1000,
        latencyMs: stats[endpointKey(endpoint)]?.p50LatencyMs ?? 1500,
      }));

  const compare = (a: RouteCandidate, b: RouteCandidate): number => {
    const ha = stats[endpointKey(a.endpoint)]?.healthy !== false;
    const hb = stats[endpointKey(b.endpoint)]?.healthy !== false;
    if (ha !== hb) return ha ? -1 : 1;
    let d = 0;
    if (sort === 'price') d = blendedCost(a.endpoint) - blendedCost(b.endpoint);
    else if (sort === 'latency') d = a.latencyMs - b.latencyMs;
    else d = b.rating - a.rating;
    return d !== 0 ? d : a.endpoint.priority - b.endpoint.priority;
  };

  let ordered: RouteCandidate[];
  if (isAuto) {
    ordered = toCandidates(requested).sort(compare);
  } else {
    // Keep the caller's model order; sort endpoints within each model.
    ordered = requested.flatMap((id) => toCandidates([id]).sort(compare));
  }

  if (ordered.length === 0) throw new RouteError(`No provider is available for "${input.model}"`, 'no_available_endpoint');
  const max = opts.fallbacks === false ? 1 : Math.max(1, opts.maxAttempts ?? 3);
  return ordered.slice(0, max);
}

/**
 * Upper bound on what a request can cost, used to reserve credits before calling a provider.
 * Unused reservation is refunded after the response.
 */
export function estimateMaxCostMicros(
  price: TokenPrice,
  promptTokensEstimate: number,
  maxCompletionTokens: number,
): number {
  return costMicros(
    { promptTokens: Math.ceil(promptTokensEstimate * 1.1) + 16, completionTokens: maxCompletionTokens },
    price,
  );
}
