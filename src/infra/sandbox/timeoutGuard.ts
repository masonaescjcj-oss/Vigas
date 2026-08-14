import type { SandboxCommandHandle, SandboxCommandResult, SandboxConnection } from "./types.ts";

export const MAX_COMMAND_TIMEOUT_MS = 60_000;
export const DEFAULT_MEMORY_LIMIT_BYTES = 1_073_741_824;

export class SandboxTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Sandbox command exceeded the ${timeoutMs} ms execution limit and was killed.`);
    this.name = "SandboxTimeoutError";
  }
}

export class SandboxMemoryLimitError extends Error {
  constructor(readonly limitBytes: number, readonly observedBytes: number) {
    super(`Sandbox command exceeded the ${limitBytes} byte memory limit and was killed.`);
    this.name = "SandboxMemoryLimitError";
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function guardedCommand(command: string, memoryLimitBytes: number): string {
  const virtualMemoryKb = Math.max(65_536, Math.floor(memoryLimitBytes / 1024));
  return `ulimit -v ${virtualMemoryKb}; exec setsid /bin/bash -lc ${shellQuote(command)}`;
}

async function killCompletely(
  connection: SandboxConnection,
  handle: SandboxCommandHandle,
  killed: () => void,
): Promise<void> {
  await connection.killProcessTree(handle.pid).catch(() => undefined);
  // The process group has been killed at this point. Settle the guard before
  // handle.kill() can settle handle.wait(), preserving the precise timeout or
  // memory-limit error for callers.
  killed();
  await handle.kill().catch(() => false);
}

export async function runWithGuards(
  connection: SandboxConnection,
  command: string,
  options: { timeoutMs?: number; memoryLimitBytes?: number; cwd?: string } = {},
): Promise<SandboxCommandResult> {
  const timeoutMs = Math.min(Math.max(1, options.timeoutMs ?? MAX_COMMAND_TIMEOUT_MS), MAX_COMMAND_TIMEOUT_MS);
  const memoryLimitBytes = Math.max(67_108_864, options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES);
  const startedAt = Date.now();
  const handle = await connection.startCommand(
    guardedCommand(command, memoryLimitBytes),
    options.cwd ?? "/home/user/project",
  );

  let finished = false;
  let peakMemoryBytes = 0;
  let rejectGuard: ((reason: Error) => void) | undefined;
  const guard = new Promise<never>((_resolve, reject) => { rejectGuard = reject; });
  const timeout = setTimeout(async () => {
    if (finished) return;
    await killCompletely(connection, handle, () => rejectGuard?.(new SandboxTimeoutError(timeoutMs)));
  }, timeoutMs);
  const memoryPoll = setInterval(async () => {
    if (finished) return;
    try {
      const used = await connection.memoryUsedBytes();
      peakMemoryBytes = Math.max(peakMemoryBytes, used);
      if (used > memoryLimitBytes) {
        await killCompletely(connection, handle, () => rejectGuard?.(new SandboxMemoryLimitError(memoryLimitBytes, used)));
      }
    } catch {
      // A transient metrics failure must not terminate an otherwise healthy command.
    }
  }, 500);

  const completion = handle.wait().then((result) => ({
    ...result,
    durationMs: Date.now() - startedAt,
    peakMemoryBytes,
  }));

  try {
    return await Promise.race([completion, guard]);
  } finally {
    finished = true;
    clearTimeout(timeout);
    clearInterval(memoryPoll);
    // If the guard won, observe the command promise after SIGKILL to prevent an
    // unhandled rejection from the SDK's stream reader.
    void completion.catch(() => undefined);
  }
}
