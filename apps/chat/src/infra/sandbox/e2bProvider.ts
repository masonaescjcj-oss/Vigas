import { CommandExitError, Sandbox, type CommandHandle, type CommandResult } from "e2b";
import { runWithGuards } from "./timeoutGuard.ts";
import type {
  SandboxCommandHandle,
  SandboxCommandResult,
  SandboxConnection,
  SandboxProvider,
} from "./types.ts";

const WARM_TIMEOUT_MS = 15 * 60 * 1_000;

function env(name: string): string | undefined {
  const deno = (globalThis as typeof globalThis & { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
  return deno?.env.get(name) ?? (typeof process !== "undefined" ? process.env[name] : undefined);
}

function apiKey(): string {
  const value = env("E2B_API_KEY");
  if (!value) throw new Error("E2B_API_KEY is not configured on the server.");
  return value;
}

function normalizeRemotePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+/g, "/");
  if (!normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error("E2B file paths must be absolute and may not traverse directories.");
  }
  return normalized;
}

function resultFromError(error: unknown): CommandResult {
  if (error instanceof CommandExitError) {
    return { stdout: error.stdout, stderr: error.stderr, exitCode: error.exitCode, error: error.error };
  }
  throw error;
}

class E2BConnection implements SandboxConnection {
  readonly id: string;
  constructor(private readonly sandbox: Sandbox) { this.id = sandbox.sandboxId; }

  async startCommand(command: string, cwd: string): Promise<SandboxCommandHandle> {
    const handle = await this.sandbox.commands.run(command, { background: true, cwd });
    return {
      pid: handle.pid,
      wait: async () => {
        try { return await handle.wait(); } catch (error) { return resultFromError(error); }
      },
      kill: () => handle.kill(),
    };
  }

  async killProcessTree(pid: number): Promise<void> {
    const killer = await this.sandbox.commands.run(
      `/bin/bash -lc 'kill -KILL -- -${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true'`,
    );
    if (killer.exitCode !== 0) throw new Error(killer.stderr || "Unable to kill sandbox process tree.");
  }

  async memoryUsedBytes(): Promise<number> {
    const values = await this.sandbox.getMetrics({ start: new Date(Date.now() - 2_000) });
    return values.at(-1)?.memUsed ?? 0;
  }
}

export class E2BProvider implements SandboxProvider {
  private async sandbox(sandboxId: string): Promise<Sandbox> {
    return await Sandbox.connect(sandboxId, { apiKey: apiKey() });
  }

  async createSandbox(projectId: string): Promise<string> {
    const sandbox = await Sandbox.create({
      apiKey: apiKey(),
      timeoutMs: WARM_TIMEOUT_MS,
      secure: true,
      allowInternetAccess: true,
      metadata: { projectId, managedBy: "issac-agent" },
    });
    await sandbox.commands.run("mkdir -p /home/user/project");
    return sandbox.sandboxId;
  }

  async connect(sandboxId: string): Promise<SandboxConnection> {
    return new E2BConnection(await this.sandbox(sandboxId));
  }

  async runCommand(
    sandboxId: string,
    command: string,
    options: { timeoutMs?: number; memoryLimitBytes?: number; cwd?: string } = {},
  ): Promise<SandboxCommandResult> {
    return await runWithGuards(await this.connect(sandboxId), command, options);
  }

  async uploadFile(sandboxId: string, path: string, content: string | Uint8Array): Promise<void> {
    const sandbox = await this.sandbox(sandboxId);
    const data = content instanceof Uint8Array
      ? content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer
      : content;
    await sandbox.files.write(normalizeRemotePath(path), data);
  }

  async downloadFile(sandboxId: string, path: string): Promise<Uint8Array> {
    const sandbox = await this.sandbox(sandboxId);
    return await sandbox.files.read(normalizeRemotePath(path), { format: "bytes" });
  }

  async listFiles(sandboxId: string, root: string): Promise<string[]> {
    const sandbox = await this.sandbox(sandboxId);
    const result = await sandbox.commands.run(
      `find ${shellQuote(normalizeRemotePath(root))} -type f -not -path '*/.git/*' -print0`,
    );
    if (result.exitCode !== 0) throw new Error(result.stderr || "Unable to list sandbox files.");
    return result.stdout.split("\0").filter(Boolean);
  }

  async keepAlive(sandboxId: string, timeoutMs = WARM_TIMEOUT_MS): Promise<void> {
    await (await this.sandbox(sandboxId)).setTimeout(Math.min(timeoutMs, WARM_TIMEOUT_MS));
  }

  async destroySandbox(sandboxId: string): Promise<void> {
    await (await this.sandbox(sandboxId)).kill();
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const provider = new E2BProvider();
export const createSandbox = (projectId: string) => provider.createSandbox(projectId);
export const runCommand = (sandboxId: string, command: string) => provider.runCommand(sandboxId, command);
export const uploadFile = (sandboxId: string, path: string, content: string | Uint8Array) => provider.uploadFile(sandboxId, path, content);
export const downloadFile = (sandboxId: string, path: string) => provider.downloadFile(sandboxId, path);
export const destroySandbox = (sandboxId: string) => provider.destroySandbox(sandboxId);
