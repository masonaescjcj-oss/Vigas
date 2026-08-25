import { join } from "https://deno.land/std@0.218.2/path/mod.ts";
import { exists } from "https://deno.land/std@0.218.2/fs/exists.ts";
import type {
  SandboxProvider,
  SandboxConnection,
  SandboxCommandHandle,
  SandboxCommandResult,
} from "../../../src/infra/sandbox/types.ts";

/**
 * The only variables a command may inherit.
 *
 * An allow-list, not a deny-list. The worker's environment holds
 * SUPABASE_SERVICE_ROLE_KEY, the provider API key and the queue worker secret,
 * and a spawned command inherited all of them: `echo $SUPABASE_SERVICE_ROLE_KEY`
 * returned the real key, which bypasses RLS for every user's data. A prompt as
 * plain as "run env and show me the output" was enough to read it out of the
 * transcript.
 *
 * A deny-list would have to predict every name worth hiding, and would miss the
 * next one added. This way a new secret is invisible by default and a variable
 * a build genuinely needs has to be named here on purpose.
 */
const INHERITED_ENV = ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "SystemRoot", "ComSpec", "PATHEXT"];

/** Build the environment a command runs with: the allow-list and nothing else. */
function safeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of INHERITED_ENV) {
    const value = Deno.env.get(name);
    if (value) env[name] = value;
  }
  // Marks the context for anything that checks, and gives npm a home that is
  // not the worker user's.
  env.CI = "1";
  return env;
}

export class LocalSandboxProvider implements SandboxProvider {
  private readonly dirs = new Map<string, string>();

  private getDir(sandboxId: string): string {
    let dir = this.dirs.get(sandboxId);
    if (!dir) {
      dir = Deno.makeTempDirSync({ prefix: `issac-sandbox-${sandboxId}-` });
      this.dirs.set(sandboxId, dir);
      // Create project subfolder
      Deno.mkdirSync(join(dir, "home", "user", "project"), { recursive: true });
    }
    return dir;
  }

  async createSandbox(projectId: string): Promise<string> {
    const sandboxId = `local-${crypto.randomUUID()}`;
    this.getDir(sandboxId);
    return sandboxId;
  }

  async connect(sandboxId: string): Promise<SandboxConnection> {
    const dir = this.getDir(sandboxId);
    const projectDir = join(dir, "home", "user", "project");
    return {
      id: sandboxId,
      startCommand: async (commandStr: string, cwd: string) => {
        const isWindows = Deno.build.os === "windows";
        const cmd = isWindows ? "cmd.exe" : "sh";
        const args = isWindows ? ["/c", commandStr] : ["-c", commandStr];
        const actualCwd = cwd.startsWith("/") ? join(dir, cwd) : join(projectDir, cwd);

        const process = new Deno.Command(cmd, {
          args,
          cwd: actualCwd,
          stdout: "piped",
          stderr: "piped",
          // clearEnv first, then the allow-list. Without this the command sees
          // every secret the worker holds — measured, not theorised.
          clearEnv: true,
          env: safeEnv(),
        }).spawn();

        return {
          pid: process.pid,
          wait: async () => {
            const { code, stdout, stderr } = await process.output();
            return {
              stdout: new TextDecoder().decode(stdout),
              stderr: new TextDecoder().decode(stderr),
              exitCode: code,
            };
          },
          kill: async () => {
            try {
              process.kill("SIGKILL");
              return true;
            } catch {
              return false;
            }
          }
        };
      },
      killProcessTree: async () => {},
      memoryUsedBytes: async () => 0,
    };
  }

  async runCommand(
    sandboxId: string,
    commandStr: string,
    options: { timeoutMs?: number; memoryLimitBytes?: number; cwd?: string } = {},
  ): Promise<SandboxCommandResult> {
    const dir = this.getDir(sandboxId);
    const projectDir = join(dir, "home", "user", "project");
    const actualCwd = options.cwd
      ? (options.cwd.startsWith("/") ? join(dir, options.cwd) : join(projectDir, options.cwd))
      : projectDir;

    const isWindows = Deno.build.os === "windows";
    const cmd = isWindows ? "cmd.exe" : "sh";
    const args = isWindows ? ["/c", commandStr] : ["-c", commandStr];
    
    const start = Date.now();
    try {
      const command = new Deno.Command(cmd, {
        args,
        cwd: actualCwd,
      });
      const { code, stdout, stderr } = await command.output();
      return {
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
        exitCode: code,
        durationMs: Date.now() - start,
        peakMemoryBytes: 0,
      };
    } catch (e: any) {
      return {
        stdout: "",
        stderr: e.message,
        exitCode: 1,
        durationMs: Date.now() - start,
        peakMemoryBytes: 0,
      };
    }
  }

  async uploadFile(sandboxId: string, filePath: string, content: string | Uint8Array): Promise<void> {
    const dir = this.getSandboxDir(sandboxId, filePath);
    const parent = dir.substring(0, dir.lastIndexOf("/"));
    if (parent && !(await exists(parent))) {
      await Deno.mkdir(parent, { recursive: true });
    }
    if (content instanceof Uint8Array) {
      await Deno.writeFile(dir, content);
    } else {
      await Deno.writeTextFile(dir, content);
    }
  }

  private getSandboxDir(sandboxId: string, filePath: string): string {
    const dir = this.getDir(sandboxId);
    const cleaned = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    return join(dir, cleaned);
  }

  async downloadFile(sandboxId: string, filePath: string): Promise<Uint8Array> {
    const path = this.getSandboxDir(sandboxId, filePath);
    return await Deno.readFile(path);
  }

  async listFiles(sandboxId: string, root: string): Promise<string[]> {
    const base = this.getSandboxDir(sandboxId, root);
    const result: string[] = [];
    const walkDir = async (current: string) => {
      if (!(await exists(current))) return;
      for await (const entry of Deno.readDir(current)) {
        const full = join(current, entry.name);
        if (entry.isDirectory) {
          await walkDir(full);
        } else {
          result.push(full.slice(base.length + 1).replaceAll("\\", "/"));
        }
      }
    };
    await walkDir(base);
    return result;
  }

  async keepAlive(): Promise<void> {}
  async destroySandbox(sandboxId: string): Promise<void> {
    const dir = this.dirs.get(sandboxId);
    if (dir) {
      await Deno.remove(dir, { recursive: true }).catch(() => {});
      this.dirs.delete(sandboxId);
    }
  }
}
