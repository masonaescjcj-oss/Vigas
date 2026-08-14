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
