import { dirname, join } from "https://deno.land/std@0.218.2/path/mod.ts";
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
  protected readonly dirs = new Map<string, string>();

  /**
   * @param root Where sandboxes are created. Defaults to a system temp dir,
   *   which is right for a laptop; a server passes a directory owned by the
   *   account commands run as, since the worker and the command are then
   *   different users.
   */
  constructor(protected readonly root?: string) {}

  protected getDir(sandboxId: string): string {
    let dir = this.dirs.get(sandboxId);
    if (!dir) {
      dir = this.root
        ? join(this.root, sandboxId)
        : Deno.makeTempDirSync({ prefix: `issac-sandbox-${sandboxId}-` });
      this.dirs.set(sandboxId, dir);
      // Create project subfolder
      Deno.mkdirSync(join(dir, "home", "user", "project"), { recursive: true });
      this.onDirCreated(dir);
    }
    return dir;
  }

  /** Hook for a subclass that has to hand the directory to another user. */
  protected onDirCreated(_dir: string): void {}

  /**
   * Build the process that runs one command.
   *
   * The seam the systemd provider replaces: everything about *where* a sandbox
   * lives is shared, and only *how* the command is launched differs.
   */
  protected buildCommand(commandStr: string, workDir: string): Deno.Command {
    const isWindows = Deno.build.os === "windows";
    return new Deno.Command(isWindows ? "cmd.exe" : "sh", {
      args: isWindows ? ["/c", commandStr] : ["-c", commandStr],
      cwd: workDir,
      stdout: "piped",
      stderr: "piped",
      // clearEnv first, then the allow-list. Without this the command sees
      // every secret the worker holds — measured, not theorised.
      clearEnv: true,
      env: safeEnv(),
    });
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
        const actualCwd = cwd.startsWith("/") ? join(dir, cwd) : join(projectDir, cwd);
        const process = this.buildCommand(commandStr, actualCwd).spawn();

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

    const start = Date.now();
    try {
      // Through the same seam as startCommand. This path had neither clearEnv
      // nor an allow-list of its own, so the leak was reachable from here too.
      const { code, stdout, stderr } = await this.buildCommand(commandStr, actualCwd).output();
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
    // dirname, not lastIndexOf("/"): join produces backslashes on Windows, so
    // the manual split found no separator, skipped the mkdir, and writing a
    // nested file failed with "cannot find the path specified".
    const parent = dirname(dir);
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

  /**
   * List files under `root`, returned the way they were asked for.
   *
   * Paths come back prefixed with `root` — "/home/user/project/index.html",
   * not "index.html" — because the caller strips that prefix itself and then
   * hands the *unstripped* path straight back to downloadFile. Returning
   * relative paths meant downloadFile resolved them against the sandbox root
   * instead of the project directory, so syncing files back after a command
   * failed on the first entry:
   *
   *   No such file or directory: readfile '/var/lib/.../<sandbox>/.keep'
   *
   * Invisible until now only because exec had never actually run in
   * production: an Edge Function cannot spawn a process, so nothing ever got
   * as far as syncing.
   */
  async listFiles(sandboxId: string, root: string): Promise<string[]> {
    const base = this.getSandboxDir(sandboxId, root);
    const prefix = root.startsWith("/") ? root : `/${root}`;
    const result: string[] = [];
    const walkDir = async (current: string) => {
      if (!(await exists(current))) return;
      for await (const entry of Deno.readDir(current)) {
        const full = join(current, entry.name);
        if (entry.isDirectory) {
          await walkDir(full);
        } else {
          const relative = full.slice(base.length + 1).replaceAll("\\", "/");
          result.push(`${prefix.replace(/\/+$/, "")}/${relative}`);
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
