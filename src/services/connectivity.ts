/**
 * frontend/src/services/connectivity.ts
 * ---------------------------------------------------------------------------
 * Deciding whether the app can reach its backend.
 *
 * The previous version pinged google.com. On any network where Google is blocked
 * or throttled — which includes Iran, where this app is being built — that fails
 * permanently, so the red banner was pinned on while the app worked perfectly.
 * A false permanent alarm is worse than no alarm: it teaches people to ignore it.
 *
 * Two changes follow from that:
 *
 *   1. Probe our own backend. "Can I reach Google" was never the question.
 *   2. Any HTTP response means connected, whatever its status. A 401 from the
 *      health endpoint proves the packets arrived, which is the entire question.
 *      Only a thrown fetch — DNS failure, no route, timeout — means offline.
 * ---------------------------------------------------------------------------
 */

/**
 * One dropped request is normal. A banner that flashes red on a single blip is
 * noise, so an outage has to be confirmed before it is announced.
 */
export const FAILURES_BEFORE_OFFLINE = 2;

/** Long enough for a slow mobile network, short enough to notice a dead one. */
export const PROBE_TIMEOUT_MS = 6_000;

/** While offline, check often — the user is waiting to be told it is back. */
export const OFFLINE_RECHECK_MS = 5_000;

/**
 * While online, check rarely. The old code polled every 15 seconds forever,
 * which on a phone is a radio wakeup every 15 seconds for information nobody
 * asked for.
 */
export const ONLINE_RECHECK_MS = 60_000;

/**
 * Where to probe.
 *
 * Supabase's auth health endpoint answers without an API key (with a 401, which
 * is a fine answer) and sends `Access-Control-Allow-Origin: *`, so it works from
 * the browser too. Deliberately not an edge function: those cold-start, and a
 * cold start is not an outage.
 */
export function probeTarget(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`;
}

/**
 * Fold a probe result into the failure count.
 *
 * @returns The new count. Reset to zero on success, so two failures must be
 *          consecutive to count.
 */
export function countFailure(current: number, reachable: boolean): number {
  return reachable ? 0 : current + 1;
}

export function isOffline(failures: number): boolean {
  return failures >= FAILURES_BEFORE_OFFLINE;
}

/**
 * Ask the network, once.
 *
 * @returns true when the server answered at all. No credential is sent: the
 *          probe should not depend on a valid session to report connectivity.
 */
export async function probeOnce(target: string): Promise<boolean> {
  // AbortController + setTimeout rather than AbortSignal.timeout, which is absent
  // from React Native's runtime. Reaching for it would have thrown on every
  // probe on device — and a probe that always throws is a permanent offline
  // banner, which is the exact bug this file exists to fix.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // A unique query rather than `cache: "no-store"`: React Native's RequestInit
    // has no `cache` field, and a proxy answering from cache would report a
    // network that is no longer there.
    const separator = target.includes("?") ? "&" : "?";
    await fetch(`${target}${separator}t=${Date.now()}`, {
      method: "GET",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
