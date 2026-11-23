import { usdToMicros } from '@vigas/core';
import { asProviderError, ProviderError, type ProviderAdapter, type StreamEvent, type UpstreamRequest, type UpstreamResult, type UpstreamUsage } from './types';

export type KeyRotationStrategy = 'round_robin' | 'random' | 'sequential' | 'least_used';

export const VALID_KEY_STRATEGIES = new Set<KeyRotationStrategy>(['round_robin', 'random', 'sequential', 'least_used']);

export function parseKeyRotationStrategy(raw: unknown, fallback: KeyRotationStrategy = 'round_robin'): KeyRotationStrategy {
  if (typeof raw !== 'string') return fallback;
  const norm = raw.trim().toLowerCase().replace(/-/g, '_') as KeyRotationStrategy;
  return VALID_KEY_STRATEGIES.has(norm) ? norm : fallback;
}

export interface PoolKeySpec {
  key: string;
  label?: string;
  /** Optional spend cap for this key in micro-USD (e.g. $100 = 100_000_000). */
  budgetMicros?: number | null;
}

export type KeyFailureKind = 'key_exhausted' | 'rate_limited' | 'model_unavailable' | 'provider_down' | 'request_rejected';

const MODEL_ACCESS_RE =
  /"?code"?\s*[:=]\s*"?(model_not_found|model_not_available|unsupported_model)|no access to model|model[\s_-]{0,4}not[\s_-](found|available|supported)|unsupported model|no enabled channel for model/i;

const CLIENT_FAULT_RE = /invalid_request|invalid_request_error|cannot unmarshal|malformed|failed to parse/i;

const EXHAUSTED_PROSE_RE =
  /insufficient|quota|exceeded your current|billing|out of credit|credit balance|balance.*exhaust|limit.*exceeded|account.*deactivated|invalid.*api.*key|api_key_invalid|api key not valid|api key expired|permission_denied|revoked/i;

const RATE_LIMIT_PROSE_RE = /resource_exhausted|rate[\s_-]?limit|too many requests|requests per minute/i;

/**
 * Classifies an upstream error so the pool knows whether to:
 * - rest/exhaust just this key and immediately rotate to the next key,
 * - skip this key for this model without harming its health, or
 * - stop immediately because the caller's request itself is malformed.
 */
export function classifyKeyFailure(status: number, message: string): KeyFailureKind {
  if (MODEL_ACCESS_RE.test(message)) return 'model_unavailable';
  if (status === 429 || RATE_LIMIT_PROSE_RE.test(message)) return 'rate_limited';
  if (status === 401 || status === 402 || status === 403) return 'key_exhausted';
  // Google AI Studio returns HTTP 400 for API_KEY_INVALID / expired keys — check before CLIENT_FAULT_RE.
  if (EXHAUSTED_PROSE_RE.test(message)) return 'key_exhausted';
  if (CLIENT_FAULT_RE.test(message)) return 'request_rejected';
  if (status >= 500 || status === 408 || status === 0) return 'provider_down';
  return 'request_rejected';
}

/**
 * Parses a comma-, semicolon-, or newline-delimited list of keys plus an optional single key,
 * deduplicating while preserving order.
 */
export function parseKeyPoolEnv(opts: {
  keysRaw?: string;
  singleKey?: string;
  budgetUsdRaw?: string;
  labelPrefix?: string;
}): PoolKeySpec[] {
  const budgetUsd = opts.budgetUsdRaw ? Number(opts.budgetUsdRaw) : NaN;
  const budgetMicros = Number.isFinite(budgetUsd) && budgetUsd > 0 ? usdToMicros(budgetUsd) : null;

  const seen = new Set<string>();
  const out: PoolKeySpec[] = [];
  const push = (rawKey: string) => {
    const key = rawKey.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      label: `${opts.labelPrefix ?? 'key'}-${String(out.length + 1).padStart(2, '0')}`,
      budgetMicros,
    });
  };

  if (opts.keysRaw) {
    for (const part of opts.keysRaw.split(/[\n,;]+/)) push(part);
  }
  if (opts.singleKey) push(opts.singleKey);
  return out;
}

export interface KeyPoolOptions {
  strategy?: KeyRotationStrategy;
  rateLimitCooldownMs?: number;
  exhaustedCooldownMs?: number;
  providerDownCooldownMs?: number;
  failureLimit?: number;
  now?: () => number;
  rng?: () => number;
}

interface KeySlot {
  index: number;
  spec: PoolKeySpec;
  uses: number;
  inFlight: number;
  spentMicros: number;
  consecutiveFailures: number;
  cooldownUntil: number;
  exhausted: boolean;
  lastUsedAt: number;
  lastError: string | null;
}

export interface KeySlotSnapshot {
  index: number;
  label: string;
  status: 'healthy' | 'cooling_down' | 'exhausted' | 'budget_capped';
  uses: number;
  inFlight: number;
  spentUsd: number;
  budgetUsd: number | null;
  cooldownRemainingSec: number;
}

export interface KeyPoolSnapshot {
  strategy: KeyRotationStrategy;
  total: number;
  healthy: number;
  coolingDown: number;
  exhausted: number;
  budgetCapped: number;
  keys: KeySlotSnapshot[];
}

/**
 * Multi-key pool supporting 4 rotation strategies:
 * - `round_robin`: cycles evenly 1 → 2 → … → N → 1 across healthy keys
 * - `random`: picks uniformly at random among healthy keys
 * - `sequential`: drains key #1 until exhausted/capped/rate-limited, then moves to #2, #3, …
 * - `least_used`: picks the healthy key with the fewest in-flight requests and total uses
 */
export class KeyPool {
  readonly strategy: KeyRotationStrategy;
  private readonly slots: KeySlot[];
  private readonly rateLimitCooldownMs: number;
  private readonly exhaustedCooldownMs: number;
  private readonly providerDownCooldownMs: number;
  private readonly failureLimit: number;
  private readonly now: () => number;
  private readonly rng: () => number;
  private cursor = 0;

  constructor(keys: PoolKeySpec[], opts: KeyPoolOptions = {}) {
    if (keys.length === 0) throw new Error('KeyPool requires at least one key');
    this.strategy = opts.strategy ?? 'round_robin';
    this.rateLimitCooldownMs = opts.rateLimitCooldownMs ?? 60_000;
    this.exhaustedCooldownMs = opts.exhaustedCooldownMs ?? 24 * 60 * 60 * 1000;
    this.providerDownCooldownMs = opts.providerDownCooldownMs ?? 30_000;
    this.failureLimit = opts.failureLimit ?? 3;
    this.now = opts.now ?? (() => Date.now());
    this.rng = opts.rng ?? (() => Math.random());
    this.slots = keys.map((spec, index) => ({
      index,
      spec: { ...spec, label: spec.label || `key-${String(index + 1).padStart(2, '0')}` },
      uses: 0,
      inFlight: 0,
      spentMicros: 0,
      consecutiveFailures: 0,
      cooldownUntil: 0,
      exhausted: false,
      lastUsedAt: 0,
      lastError: null,
    }));
  }

  get size(): number {
    return this.slots.length;
  }

  private isBudgetCapped(slot: KeySlot): boolean {
    return slot.spec.budgetMicros != null && slot.spentMicros >= slot.spec.budgetMicros;
  }

  private isEligible(slot: KeySlot, now: number, exclude?: ReadonlySet<number>): boolean {
    if (exclude?.has(slot.index)) return false;
    if (this.isBudgetCapped(slot)) return false;
    if (slot.cooldownUntil > now) return false;
    return true;
  }

  acquire(exclude?: ReadonlySet<number>): { index: number; spec: PoolKeySpec } | null {
    const now = this.now();
    const eligible = this.slots.filter((s) => this.isEligible(s, now, exclude));
    if (eligible.length === 0) return null;

    let chosen: KeySlot;
    if (this.strategy === 'sequential') {
      chosen = eligible[0]!;
    } else if (this.strategy === 'random') {
      const r = Math.min(eligible.length - 1, Math.max(0, Math.floor(this.rng() * eligible.length)));
      chosen = eligible[r]!;
    } else if (this.strategy === 'least_used') {
      chosen = [...eligible].sort(
        (a, b) => a.inFlight - b.inFlight || a.uses - b.uses || a.spentMicros - b.spentMicros || a.index - b.index,
      )[0]!;
    } else {
      // round_robin: scan forward from cursor so load spreads strictly evenly.
      const n = this.slots.length;
      chosen = eligible[0]!;
      for (let offset = 0; offset < n; offset++) {
        const idx = (this.cursor + offset) % n;
        const candidate = this.slots[idx]!;
        if (this.isEligible(candidate, now, exclude)) {
          chosen = candidate;
          this.cursor = (idx + 1) % n;
          break;
        }
      }
    }

    chosen.inFlight += 1;
    chosen.uses += 1;
    chosen.lastUsedAt = now;
    return { index: chosen.index, spec: chosen.spec };
  }

  recordSuccess(index: number, costMicros = 0): void {
    const slot = this.slots[index];
    if (!slot) return;
    slot.inFlight = Math.max(0, slot.inFlight - 1);
    slot.consecutiveFailures = 0;
    slot.cooldownUntil = 0;
    slot.exhausted = false;
    slot.lastError = null;
    if (costMicros > 0) slot.spentMicros += costMicros;
  }

  /**
   * Records a failure on key `index` and returns whether the caller should immediately rotate
   * to another healthy key in this pool.
   */
  recordFailure(index: number, err: ProviderError): { kind: KeyFailureKind; rotate: boolean } {
    const slot = this.slots[index];
    const kind = classifyKeyFailure(err.status, err.message);
    if (!slot) return { kind, rotate: false };

    slot.inFlight = Math.max(0, slot.inFlight - 1);
    slot.lastError = err.message.slice(0, 160);
    const now = this.now();

    if (kind === 'request_rejected') {
      return { kind, rotate: false };
    }
    if (kind === 'model_unavailable') {
      // Do not rest a healthy key just because it cannot serve one model id.
      return { kind, rotate: true };
    }
    if (kind === 'key_exhausted') {
      slot.exhausted = true;
      slot.consecutiveFailures += 1;
      slot.cooldownUntil = now + this.exhaustedCooldownMs;
      return { kind, rotate: true };
    }
    if (kind === 'rate_limited') {
      slot.consecutiveFailures += 1;
      slot.cooldownUntil = now + this.rateLimitCooldownMs;
      return { kind, rotate: true };
    }

    // provider_down (5xx / timeout / network)
    slot.consecutiveFailures += 1;
    if (slot.consecutiveFailures >= this.failureLimit) {
      slot.cooldownUntil = now + this.providerDownCooldownMs;
    }
    return { kind, rotate: true };
  }

  /** Safe telemetry snapshot (never includes raw API keys). */
  snapshot(): KeyPoolSnapshot {
    const now = this.now();
    let healthy = 0;
    let coolingDown = 0;
    let exhausted = 0;
    let budgetCapped = 0;

    const keys: KeySlotSnapshot[] = this.slots.map((s) => {
      let status: KeySlotSnapshot['status'] = 'healthy';
      let cooldownRemainingSec = 0;
      if (this.isBudgetCapped(s)) {
        status = 'budget_capped';
        budgetCapped += 1;
      } else if (s.cooldownUntil > now) {
        cooldownRemainingSec = Math.ceil((s.cooldownUntil - now) / 1000);
        if (s.exhausted) {
          status = 'exhausted';
          exhausted += 1;
        } else {
          status = 'cooling_down';
          coolingDown += 1;
        }
      } else {
        healthy += 1;
      }
      return {
        index: s.index,
        label: s.spec.label ?? `key-${s.index + 1}`,
        status,
        uses: s.uses,
        inFlight: s.inFlight,
        spentUsd: Number((s.spentMicros / 1_000_000).toFixed(4)),
        budgetUsd: s.spec.budgetMicros != null ? Number((s.spec.budgetMicros / 1_000_000).toFixed(2)) : null,
        cooldownRemainingSec,
      };
    });

    return { strategy: this.strategy, total: this.slots.length, healthy, coolingDown, exhausted, budgetCapped, keys };
  }
}

/**
 * Wraps any `ProviderAdapter` factory with a `KeyPool`, rotating across keys according to the
 * configured strategy and transparently retrying another healthy key on 429 / 401 / 402 / 403 / 5xx
 * before surfacing an error to the gateway router.
 */
export class MultiKeyAdapter implements ProviderAdapter {
  private readonly adapters = new Map<number, ProviderAdapter>();
  private readonly maxAttempts: number;
  private readonly estimateKeyCostMicros?: (usage: UpstreamUsage | null) => number;

  constructor(
    readonly slug: string,
    readonly pool: KeyPool,
    private readonly createAdapter: (apiKey: string) => ProviderAdapter,
    opts: { maxAttempts?: number; estimateKeyCostMicros?: (usage: UpstreamUsage | null) => number } = {},
  ) {
    this.maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? pool.size, 25));
    this.estimateKeyCostMicros = opts.estimateKeyCostMicros;
  }

  private adapterFor(index: number, apiKey: string): ProviderAdapter {
    let adapter = this.adapters.get(index);
    if (!adapter) {
      adapter = this.createAdapter(apiKey);
      this.adapters.set(index, adapter);
    }
    return adapter;
  }

  async complete(req: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResult> {
    const tried = new Set<number>();
    let lastErr: ProviderError | null = null;

    while (tried.size < this.maxAttempts) {
      const lease = this.pool.acquire(tried);
      if (!lease) break;
      tried.add(lease.index);

      try {
        const result = await this.adapterFor(lease.index, lease.spec.key).complete(req, signal);
        const cost = this.estimateKeyCostMicros ? this.estimateKeyCostMicros(result.usage) : 0;
        this.pool.recordSuccess(lease.index, cost);
        return result;
      } catch (err) {
        const pe = asProviderError(err);
        lastErr = pe;
        const { rotate } = this.pool.recordFailure(lease.index, pe);
        if (!rotate || signal.aborted) throw pe;
      }
    }

    if (lastErr) {
      // If all keys in this pool were exhausted (e.g. 401/402/403), mark retryable so the gateway
      // can still fall over to a secondary provider if one exists.
      if (lastErr.status === 401 || lastErr.status === 402 || lastErr.status === 403) {
        throw new ProviderError(`${this.slug}: upstream key pool exhausted`, 503, true, 'pool_exhausted');
      }
      throw lastErr;
    }
    throw new ProviderError(`${this.slug}: no healthy upstream keys available`, 503, true, 'pool_exhausted');
  }

  async *stream(req: UpstreamRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    const tried = new Set<number>();
    let lastErr: ProviderError | null = null;

    while (tried.size < this.maxAttempts) {
      const lease = this.pool.acquire(tried);
      if (!lease) break;
      tried.add(lease.index);

      const iterator = this.adapterFor(lease.index, lease.spec.key).stream(req, signal)[Symbol.asyncIterator]();
      let first: IteratorResult<StreamEvent>;
      try {
        first = await iterator.next();
      } catch (err) {
        const pe = asProviderError(err);
        lastErr = pe;
        const { rotate } = this.pool.recordFailure(lease.index, pe);
        if (!rotate || signal.aborted) throw pe;
        continue;
      }

      // First chunk arrived — commit to this key and stream to completion.
      let usage: UpstreamUsage | null = null;
      try {
        let cur = first;
        while (!cur.done) {
          if (cur.value.type === 'usage') usage = cur.value.usage;
          yield cur.value;
          cur = await iterator.next();
        }
        const cost = this.estimateKeyCostMicros ? this.estimateKeyCostMicros(usage) : 0;
        this.pool.recordSuccess(lease.index, cost);
        return;
      } catch (err) {
        const pe = asProviderError(err);
        this.pool.recordFailure(lease.index, pe);
        throw pe;
      }
    }

    if (lastErr) {
      if (lastErr.status === 401 || lastErr.status === 402 || lastErr.status === 403) {
        throw new ProviderError(`${this.slug}: upstream key pool exhausted`, 503, true, 'pool_exhausted');
      }
      throw lastErr;
    }
    throw new ProviderError(`${this.slug}: no healthy upstream keys available`, 503, true, 'pool_exhausted');
  }
}
