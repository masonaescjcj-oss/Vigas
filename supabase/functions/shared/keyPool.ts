/**
 * supabase/functions/shared/keyPool.ts
 * ---------------------------------------------------------------------------
 * Choosing which platform API key to use, and deciding what a failure means.
 *
 * The problem this solves: one key runs out of credit at 2am and every user is
 * stuck until someone notices and redeploys. With a pool, the next key takes
 * over on the spot and the dead one is marked so the operator can see it.
 *
 * The selection and the failure classification are pure functions, separate
 * from the database, because both are easy to get subtly wrong: rotating in a
 * way that hammers one key, or treating "your prompt was malformed" as "this
 * key is dead" and burning the whole pool on one bad request.
 * ---------------------------------------------------------------------------
 */

export interface PoolKey {
  id: string;
  label: string;
  base_url: string;
  key_cipher: string;
  model: string | null;
  priority: number;
  is_active: boolean;
  last_used_at: string | null;
  exhausted_at: string | null;
  failure_count: number;
}

/**
 * How long an exhausted key is left alone before it is tried again. Rate
 * limits lift and credit gets topped up, so "exhausted" is a rest, not a
 * grave — but retrying immediately would just spend the whole pool on the
 * same wall.
 */
export const EXHAUSTED_COOLDOWN_MS = 30 * 60 * 1000;

/** Consecutive failures before a key is rested even without a clear signal. */
export const FAILURE_LIMIT = 3;

export type FailureKind =
  /** The key is finished for now: no credit, rate limited, revoked. */
  | "key_exhausted"
  /** The provider is having a bad time; the key is probably fine. */
  | "provider_down"
  /** Our request was wrong. Rotating would burn the pool for nothing. */
  | "request_rejected";

/**
 * What an upstream failure says about the key.
 *
 * The distinction that matters: 401/403/429 and quota messages mean try the
 * next key; a 400 means our own request was malformed and every other key
 * would reject it identically.
 */
export function classifyFailure(status: number, body: string): FailureKind {
  const text = body.toLowerCase();

  if (status === 401 || status === 403 || status === 402 || status === 429) {
    return "key_exhausted";
  }
  if (
    text.includes("insufficient") ||
    text.includes("quota") ||
    text.includes("exceeded your current") ||
    text.includes("billing") ||
    text.includes("credit")
  ) {
    return "key_exhausted";
  }
  if (status >= 500 || status === 408 || status === 0) return "provider_down";
  return "request_rejected";
}

/** Whether a rested key has waited long enough to be worth trying again. */
export function isRested(key: PoolKey, now: number): boolean {
  if (!key.exhausted_at) return true;
  return now - Date.parse(key.exhausted_at) >= EXHAUSTED_COOLDOWN_MS;
}

/**
 * The order to try keys in.
 *
 * Priority first, because that is the operator's stated preference — cheap
 * provider before expensive one. Within a priority, least-recently-used, so
 * ten keys from the same site share the load instead of the first one taking
 * every request until it dies.
 *
 * Rested-but-not-recovered keys go last rather than being dropped: if every
 * key is exhausted, trying a stale one beats failing outright.
 */
export function orderKeys(keys: PoolKey[], now: number): PoolKey[] {
  const usable = keys.filter((key) => key.is_active);

  const rank = (key: PoolKey) => (isRested(key, now) ? 0 : 1);
  const usedAt = (key: PoolKey) => (key.last_used_at ? Date.parse(key.last_used_at) : 0);

  return [...usable].sort((a, b) =>
    rank(a) - rank(b) ||
    a.priority - b.priority ||
    usedAt(a) - usedAt(b) ||
    a.id.localeCompare(b.id)
  );
}

/** The state to write back after a key is used. */
export function nextHealth(
  key: PoolKey,
  outcome: { ok: true } | { ok: false; kind: FailureKind; detail: string },
  now: Date,
): Record<string, unknown> {
  const stamp = now.toISOString();

  if (outcome.ok) {
    // Success clears everything: whatever was wrong is over.
    return {
      last_used_at: stamp,
      last_ok_at: stamp,
      last_error: null,
      failure_count: 0,
      exhausted_at: null,
    };
  }

  // A rejected request says nothing about the key, so its health is untouched
  // beyond noting that it was used.
  if (outcome.kind === "request_rejected") {
    return { last_used_at: stamp, last_error: outcome.detail };
  }

  const failures = key.failure_count + 1;
  const rest = outcome.kind === "key_exhausted" || failures >= FAILURE_LIMIT;

  return {
    last_used_at: stamp,
    last_error: outcome.detail,
    failure_count: failures,
    // Keep the original rest time if it is already resting, so a key cannot
    // have its cooldown extended forever by repeated attempts.
    exhausted_at: rest ? (key.exhausted_at ?? stamp) : key.exhausted_at,
  };
}
