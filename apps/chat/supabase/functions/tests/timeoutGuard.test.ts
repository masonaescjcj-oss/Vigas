import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runWithGuards, SandboxTimeoutError } from "../../../src/infra/sandbox/timeoutGuard.ts";
import type { SandboxCommandHandle, SandboxConnection } from "../../../src/infra/sandbox/types.ts";

Deno.test("timeoutGuard kills a command after the hard deadline", async () => {
  let killed = false;
  let resolveWait: ((result: { stdout: string; stderr: string; exitCode: number }) => void) | undefined;
  const handle: SandboxCommandHandle = {
    pid: 42,
    wait: () => new Promise((resolve) => { resolveWait = resolve; }),
    kill: async () => { killed = true; resolveWait?.({ stdout: "", stderr: "killed", exitCode: 137 }); return true; },
  };
  const connection: SandboxConnection = {
    id: "test",
    startCommand: async () => handle,
    killProcessTree: async () => { killed = true; },
    memoryUsedBytes: async () => 0,
  };
  let error: unknown;
  try { await runWithGuards(connection, "sleep 30", { timeoutMs: 20 }); } catch (caught) { error = caught; }
  assert(error instanceof SandboxTimeoutError);
  assert(killed, "the underlying process must be killed, not merely detached");
  assertEquals((error as SandboxTimeoutError).timeoutMs, 20);
});
