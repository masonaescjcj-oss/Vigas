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

export function retryDecision(attempts: number): { status: "pending" | "failed"; delaySeconds: number | null } {
  const delaySeconds = retryDelaySeconds(attempts);
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
    const decision = retryDecision(options.attempts);
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
