/**
 * server-worker.ts
 * ---------------------------------------------------------------------------
 * The queue worker as a long-running service.
 *
 * Same job as the Edge Function, on a machine that can spawn processes — which
 * is the whole point. An Edge Function cannot, so `bash` is withheld there;
 * here it works, and the agent can typecheck what it wrote, install a
 * dependency, run a test.
 *
 * Different from run-local-worker.ts, which is a development script: this one
 * has to survive being a service. It shuts down without abandoning a job
 * mid-run, says which host claimed what, and backs off instead of hammering a
 * database that is refusing it.
 * ---------------------------------------------------------------------------
 */

import { createServiceClient } from "./supabase/functions/shared/supabase.ts";
import { processNextJob } from "./supabase/functions/queue-worker/index.ts";
import { systemdSandboxAvailable } from "./supabase/functions/shared/systemdProvider.ts";

/** Gap between polls when there was nothing to do. */
const IDLE_MS = 3_000;
/** Longest gap after repeated failures. */
const MAX_BACKOFF_MS = 60_000;

/**
 * Names this worker in the queue's lock column.
 *
 * Hostname, not a bare uuid: when a job behaves oddly the first question is
 * which machine ran it, and "local-worker:<uuid>" cannot answer that.
 */
const WORKER_ID = `server:${Deno.hostname()}:${crypto.randomUUID().slice(0, 8)}`;

let running = true;
let active = 0;

function log(message: string): void {
  // journald adds its own timestamp; a second one is noise.
  console.log(`[worker] ${message}`);
}

/**
 * Stop taking work, then wait for the current job.
 *
 * A killed run leaves a job locked until the stale-lease sweep releases it, and
 * the user sees a build that stopped for no reason.
 *
 * "Finishing takes seconds" is what this comment used to say, and it was wrong
 * by an order of magnitude: a real build was measured at 263 seconds. With
 * TimeoutStopSec at 120, every deploy killed whatever was running — systemd
 * waited, gave up, and SIGKILLed the worker mid-job. It is 600 now, matching
 * the queue's stale-lease window, and the unit lives in deploy/ rather than
 * only on the server.
 */
function shutdown(signal: string): void {
  if (!running) return;
  running = false;
  log(`${signal} received — finishing ${active} job(s), then exiting`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  try {
    Deno.addSignalListener(signal, () => shutdown(signal));
  } catch {
    // Not every platform has both; losing one is not worth refusing to start.
  }
}

const service = createServiceClient();

log(`starting as ${WORKER_ID}`);
log(`sandbox: ${
  Deno.env.get("E2B_API_KEY")
    ? "E2B"
    : systemdSandboxAvailable()
      ? "systemd-run (capped, unprivileged)"
      : "plain subprocess — no limits, no isolation"
}`);

let failures = 0;

while (running) {
  try {
    active += 1;
    const result = await processNextJob(service, WORKER_ID);
    if (result.processed) {
      log(`job ${result.jobId} -> ${result.status}`);
      failures = 0;
      // Straight back round: a busy queue should not wait out the idle gap.
      continue;
    }
    failures = 0;
  } catch (error) {
    failures += 1;
    log(`error (${failures} in a row): ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    active -= 1;
  }

  if (!running) break;
  // Exponential while failing, so a database that is down is not also being
  // hammered; the idle gap otherwise.
  const wait = failures > 0
    ? Math.min(IDLE_MS * 2 ** Math.min(failures, 5), MAX_BACKOFF_MS)
    : IDLE_MS;
  await new Promise((resolve) => setTimeout(resolve, wait));
}

log("stopped");
