export interface SandboxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  peakMemoryBytes: number;
}

export interface SandboxCommandHandle {
  readonly pid: number;
  wait(): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  kill(): Promise<boolean>;
}

export interface SandboxConnection {
  readonly id: string;
  startCommand(command: string, cwd: string): Promise<SandboxCommandHandle>;
  killProcessTree(pid: number): Promise<void>;
  memoryUsedBytes(): Promise<number>;
}

export interface SandboxProvider {
  createSandbox(projectId: string): Promise<string>;
  connect(sandboxId: string): Promise<SandboxConnection>;
  runCommand(
    sandboxId: string,
    command: string,
    options?: { timeoutMs?: number; memoryLimitBytes?: number; cwd?: string },
  ): Promise<SandboxCommandResult>;
  uploadFile(sandboxId: string, path: string, content: string | Uint8Array): Promise<void>;
  downloadFile(sandboxId: string, path: string): Promise<Uint8Array>;
  listFiles(sandboxId: string, root: string): Promise<string[]>;
  keepAlive(sandboxId: string, timeoutMs: number): Promise<void>;
  destroySandbox(sandboxId: string): Promise<void>;
}
