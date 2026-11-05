import type { EndpointStats, ModelInfo, ProviderEndpoint } from '@vigas/core';
import { getLeaderboard, listEndpoints, listModels, type Db } from '@vigas/db';

/**
 * Per-endpoint health: a circuit breaker (opens after 3 consecutive retryable failures, for 30s)
 * and an exponentially weighted latency used for "latency" routing.
 */
export class EndpointHealth {
  private readonly state = new Map<string, { failures: number; openUntil: number; latency?: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
  ) {}

  success(key: string, latencyMs: number): void {
    const s = this.state.get(key) ?? { failures: 0, openUntil: 0 };
    s.failures = 0;
    s.openUntil = 0;
    s.latency = s.latency === undefined ? latencyMs : Math.round(s.latency * 0.8 + latencyMs * 0.2);
    this.state.set(key, s);
  }

  failure(key: string): void {
    const s = this.state.get(key) ?? { failures: 0, openUntil: 0 };
    s.failures += 1;
    if (s.failures >= this.threshold) s.openUntil = this.now() + this.cooldownMs;
    this.state.set(key, s);
  }

  stats(): Record<string, EndpointStats> {
    const out: Record<string, EndpointStats> = {};
    const t = this.now();
    for (const [k, s] of this.state) out[k] = { healthy: s.openUntil <= t, p50LatencyMs: s.latency };
    return out;
  }
}

/** Fixed-window-free token bucket: `rpm` requests per minute per key, refilled continuously. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly rpm: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns seconds to wait, or 0 if the request may proceed. */
  take(key: string): number {
    if (this.rpm <= 0) return 0;
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.rpm, at: t };
    b.tokens = Math.min(this.rpm, b.tokens + ((t - b.at) / 60_000) * this.rpm);
    b.at = t;
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      return Math.ceil(((1 - b.tokens) / this.rpm) * 60);
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.buckets.clear();
    return 0;
  }
}

export interface CatalogSnapshot {
  models: ModelInfo[];
  endpoints: ProviderEndpoint[];
  ratings: Record<string, number>;
}

/** Catalogue, endpoints and ratings from the database, refreshed at most every `ttlMs`. */
export class CatalogCache {
  private snapshot: CatalogSnapshot | null = null;
  private loadedAt = 0;
  private pending: Promise<CatalogSnapshot> | null = null;

  constructor(
    private readonly db: Db,
    private readonly ttlMs = 60_000,
  ) {}

  async get(): Promise<CatalogSnapshot> {
    if (this.snapshot && Date.now() - this.loadedAt < this.ttlMs) return this.snapshot;
    this.pending ??= this.load().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async load(): Promise<CatalogSnapshot> {
    const [models, endpoints, board] = await Promise.all([listModels(this.db), listEndpoints(this.db), getLeaderboard(this.db, 'overall')]);
    const ratings = Object.fromEntries(board.entries.map((e) => [e.modelId, e.rating]));
    this.snapshot = { models, endpoints, ratings };
    this.loadedAt = Date.now();
    return this.snapshot;
  }
}
