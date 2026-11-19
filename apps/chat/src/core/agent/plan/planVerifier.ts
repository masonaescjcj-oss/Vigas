/**
 * plan/planVerifier.ts
 * ---------------------------------------------------------------------------
 * Automatic verification after execution — the "/goal" loop. Rather than
 * declaring success blindly, the verifier runs a real check (e.g. build/lint/
 * tests in the sandbox) and INSPECTS its result. If the check fails and a
 * repair callback is provided, it attempts a fix and re-verifies, repeating up
 * to `maxAttempts`. Success is only reported when the check actually passes.
 * ---------------------------------------------------------------------------
 */

import type { PlanEvent, VerificationResult } from "./types.ts";
import type { SecureInvoke } from "./secureInvoker.ts";

export interface Verifier {
  /** Run the check for the given attempt; ok reflects a REAL result. */
  (attempt: number): Promise<{ ok: boolean; output: string }>;
}

export interface VerifyDeps {
  verify: Verifier;
  maxAttempts: number;
  /** Optional fix step run between failed attempts (makes this a goal loop). */
  repair?: (failureOutput: string, attempt: number) => Promise<void>;
  onEvent?: (e: PlanEvent) => void;
  now: () => number;
}

export async function verifyUntilPass(deps: VerifyDeps): Promise<VerificationResult> {
  const emit = (e: PlanEvent) => deps.onEvent?.(e);
  const maxAttempts = Math.max(1, deps.maxAttempts);
  let lastOutput = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit({ kind: "verify:start", attempt, at: deps.now() });
    const { ok, output } = await deps.verify(attempt);
    lastOutput = output;
    emit({ kind: "verify:end", attempt, ok, output, at: deps.now() });

    if (ok) return { passed: true, attempts: attempt, lastOutput };

    // Not the last attempt? Try to repair, then loop and re-verify.
    if (attempt < maxAttempts && deps.repair) {
      await deps.repair(output, attempt);
    }
  }
  return { passed: false, attempts: maxAttempts, lastOutput };
}

/**
 * Build a verifier that runs a shell command through the secure invoker and
 * treats a non-error, non-"blocked" result as success. This is a REAL check:
 * the command's own exit status determines pass/fail.
 */
export function commandVerifier(invoke: SecureInvoke, command: string): Verifier {
  return async () => {
    const { result, decision } = await invoke("bash", { command });
    const ok = decision !== "deny" && !result.isError;
    return { ok, output: result.content };
  };
}
