export type QueueJobStatus = "pending" | "processing" | "completed" | "failed";

export interface QueueJob {
  id: string;
  user_id: string;
  project_id: string;
  session_id: string;
  payload: Record<string, unknown>;
  status: QueueJobStatus;
  attempts: number;
  max_attempts: number;
}

export function retryDelaySeconds(attempts: number): number | null {
  if (attempts >= 4) return null;
  return attempts === 1 ? 10 : attempts === 2 ? 30 : 60;
}

/**
 * Whether the error is the model provider refusing work rather than the run
 * being wrong.
 *
 * These read as failures but are not: the same request a minute later succeeds.
 * A gateway under load answers "system cpu overloaded (current: 100.0%,
 * threshold: 90%)" — measured against the configured provider, where a build
 * that spanned several turns lost a whole leg to it while single requests kept
 * returning 200. Four tries inside 100 seconds is not long enough to outlast a
 * busy upstream, and giving up there throws away a build that was working.
 *
 * Matched on shape, not on one vendor's wording, because the provider is
 * configurable and every gateway phrases this differently. Anything unrecognised
 * keeps the short schedule — retrying a genuine error for ten minutes is its own
 * kind of broken.
 */
export function isUpstreamOverloaded(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /(429|500|502|503|504)/.test(m) ||
    m.includes("overload") ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("too many requests") ||
    m.includes("capacity") ||
    m.includes("try again") ||
    m.includes("temporarily unavailable") ||
    m.includes("service unavailable") ||
    m.includes("timeout") ||
    m.includes("timed out")
  );
}

/**
 * Backoff for an upstream that is shedding load.
 *
 * Longer and more patient than the general schedule: the useful response to
 * "come back later" is to actually come back later. Nine tries over roughly
 * twenty minutes, against four over one hundred seconds.
 */
export function overloadedDelaySeconds(attempts: number): number | null {
  if (attempts >= 9) return null;
  return Math.min(30 * 2 ** (attempts - 1), 300);
}

export function retryDecision(
  attempts: number,
  errorMessage?: string,
): { status: "pending" | "failed"; delaySeconds: number | null } {
  const delaySeconds = errorMessage && isUpstreamOverloaded(errorMessage)
    ? overloadedDelaySeconds(attempts)
    : retryDelaySeconds(attempts);
  return delaySeconds === null ? { status: "failed", delaySeconds: null } : { status: "pending", delaySeconds };
}

export async function processJobAttempt<T>(options: {
  attempts: number;
  execute: () => Promise<T>;
  complete: (result: T) => Promise<void>;
  retry: (error: Error, delaySeconds: number) => Promise<void>;
  fail: (error: Error) => Promise<void>;
}): Promise<{ status: "completed" | "pending" | "failed"; result?: T }> {
  try {
    const result = await options.execute();
    await options.complete(result);
    return { status: "completed", result };
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const decision = retryDecision(options.attempts, error.message);
    if (decision.status === "failed") await options.fail(error);
    else await options.retry(error, decision.delaySeconds!);
    return { status: decision.status };
  }
}

/**
 * The prompt a continuation leg runs with.
 *
 * Deliberately not the user's original words: replaying "build me a shop" makes
 * the agent start the shop again. It has to be told that the previous attempt
 * is behind it and still there.
 */
export const CONTINUE_PROMPT =
  "Continue the previous turn. The transcript and the files you already wrote " +
  "are still there — carry on from where you stopped rather than starting over, " +
  "and finish the remaining work.";

/**
 * Whether a run that stopped early may hand itself on, and with what payload.
 *
 * A large request — "a whole shop, front to back" — does not fit in one turn's
 * step budget and should not have to. The session keeps the transcript and the
 * sandbox keeps the files, so the next job can simply carry on.
 *
 * Bounded: an agent can always find one more improvement to make, and each leg
 * costs tokens. Past the limit the run stops and the user decides whether to
 * keep going — which is the right place for that judgement.
 *
 * Pure, so the rule is testable without a database. The caller does the insert.
 */
export function continuationPayload(
  payload: Record<string, unknown>,
  maxContinuations: number,
): Record<string, unknown> | null {
  const done = Number(payload.continuation ?? 0);
  // NaN from a malformed payload must not read as "plenty left".
  const soFar = Number.isFinite(done) ? Math.max(0, done) : maxContinuations;
  if (!(maxContinuations > 0) || soFar >= maxContinuations) return null;
  return {
    ...payload,
    // "resume" would re-run the previous turn. This is a new turn on the same
    // session, which is what continuing actually is.
    mode: "run",
    prompt: CONTINUE_PROMPT,
    continuation: soFar + 1,
  };
}
