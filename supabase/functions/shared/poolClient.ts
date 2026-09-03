/**
 * supabase/functions/shared/poolClient.ts
 * ---------------------------------------------------------------------------
 * Calling a model through the platform key pool, with failover.
 *
 * A single key is a single point of failure: it runs out at 2am and every user
 * is stuck. This tries keys in the operator's order, and when one reports no
 * credit or a rate limit it moves to the next *within the same request* — the
 * user sees an answer, not an error, and the dead key is marked for the admin
 * panel.
 *
 * A malformed request is not a key problem, so it stops immediately rather
 * than burning the whole pool proving that every key rejects the same body.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyFailure, isRested, nextHealth, orderKeys, type PoolKey } from "./keyPool.ts";
import { openSecret } from "./secretBox.ts";
import { AppError } from "./errorHandler.ts";

export interface PoolCredentials {
  apiKey: string;
  baseUrl: string;
  model?: string;
  label: string;
  keyId: string;
}

const POOL_COLUMNS =
  "id,label,base_url,key_cipher,model,priority,is_active,last_used_at,exhausted_at,failure_count";

/** The keys to try, best first. Empty when the pool is empty or unusable. */
/**
 * @param restedOnly Drop keys still inside their cool-down instead of merely
 *                   ranking them last. For a caller that will try every
 *                   candidate in turn, a tired key at the back of the queue
 *                   costs one failed attempt. For a caller that takes only the
 *                   first — which is how a run picks its credentials — it is
 *                   the difference between falling back to the server's own key
 *                   and stranding every user behind one bad key an operator
 *                   pasted in.
 */
export async function poolCandidates(
  service: SupabaseClient,
  restedOnly = false,
): Promise<PoolCredentials[]> {
  const { data, error } = await service
    .from("platform_providers")
    .select(POOL_COLUMNS)
    .eq("is_active", true);
  // A missing table (the migration has not run) is not worth failing over: the
  // caller falls back to the environment's key.
  if (error || !data?.length) return [];

  const now = Date.now();
  const ordered = orderKeys(data as unknown as PoolKey[], now);
  const usable: PoolCredentials[] = [];
  for (const row of ordered) {
    if (restedOnly && !isRested(row, now)) continue;
    try {
      usable.push({
        apiKey: await openSecret(String(row.key_cipher)),
        baseUrl: String(row.base_url),
        model: row.model ? String(row.model) : undefined,
        label: String(row.label),
        keyId: String(row.id),
      });
    } catch {
      // Undecryptable — PROVIDER_KEY_SECRET was rotated. Skip it; the admin
      // panel shows it as never verified.
    }
  }
  return usable;
}

/** Record how a key behaved, so the operator can see which one died. */
export async function recordPoolOutcome(
  service: SupabaseClient,
  keyId: string,
  outcome: { ok: true } | { ok: false; status: number; body: string },
): Promise<void> {
  const { data } = await service
    .from("platform_providers").select(POOL_COLUMNS).eq("id", keyId).maybeSingle();
  if (!data) return;

  const patch = outcome.ok
    ? nextHealth(data as unknown as PoolKey, { ok: true }, new Date())
    : nextHealth(
        data as unknown as PoolKey,
        {
          ok: false,
          kind: classifyFailure(outcome.status, outcome.body),
          detail: `${outcome.status}: ${outcome.body.slice(0, 200)}`,
        },
        new Date(),
      );

  await service.from("platform_providers").update(patch).eq("id", keyId);
}

/**
 * Run `attempt` against each key until one succeeds.
 *
 * @param attempt Resolves on success; on failure returns the upstream status
 *                and body so the pool can tell "no credit" from "bad request".
 */
export async function withPoolFailover<T>(
  service: SupabaseClient,
  attempt: (credentials: PoolCredentials) => Promise<
    { ok: true; value: T } | { ok: false; status: number; body: string }
  >,
  fallback: () => Promise<T>,
): Promise<{ value: T; usedLabel: string | null }> {
  const candidates = await poolCandidates(service);
  if (candidates.length === 0) return { value: await fallback(), usedLabel: null };

  let lastDetail = "";
  for (const credentials of candidates) {
    const result = await attempt(credentials);

    if (result.ok) {
      await recordPoolOutcome(service, credentials.keyId, { ok: true }).catch(() => {});
      return { value: result.value, usedLabel: credentials.label };
    }

    await recordPoolOutcome(service, credentials.keyId, {
      ok: false,
      status: result.status,
      body: result.body,
    }).catch(() => {});

    lastDetail = `${result.status}: ${result.body.slice(0, 200)}`;

    // Our own request is the problem — every other key would say the same.
    if (classifyFailure(result.status, result.body) === "request_rejected") break;
  }

  throw new AppError(
    502,
    "ALL_PROVIDERS_FAILED",
    `Every configured provider refused the request. Last said — ${lastDetail}`,
  );
}
