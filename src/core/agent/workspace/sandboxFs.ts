/**
 * workspace/sandboxFs.ts
 * ---------------------------------------------------------------------------
 * A concrete {@link Workspace} implementation backed by the local filesystem,
 * with every path forced through the sandbox pathGuard. This is the "host
 * filesystem" adapter the tools run against. It confines all reads, writes,
 * listing, globbing, grepping, and command execution to the sandbox root.
 *
 * (Provided here because the runtime needs a real Workspace to be runnable
 * end-to-end; it implements the Phase-1 `Workspace` contract unchanged.)
 * ---------------------------------------------------------------------------
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import type { Workspace } from "../toolRegistry.ts";
import { resolveAndValidatePath } from "../sandbox/pathGuard.ts";

const DEFAULT_IGNORES = new Set([".git", "node_modules", ".DS_Store", "dist", "build", ".next"]);

export interface SandboxFsOptions {
  sandboxRoot: string;
  /** Directory names to skip during glob/grep walks. */
  ignores?: Set<string>;
  /** Whether the pathGuard should resolve symlinks (default true). */
  followSymlinks?: boolean;
}

export class SandboxFs implements Workspace {
  readonly root: string;
  private readonly ignores: Set<string>;
  private readonly followSymlinks: boolean;

  constructor(opts: SandboxFsOptions) {
    this.root = path.resolve(opts.sandboxRoot);
    this.ignores = opts.ignores ?? DEFAULT_IGNORES;
    this.followSymlinks = opts.followSymlinks !== false;
    fs.mkdirSync(this.root, { recursive: true });
  }

  private resolve(p: string): string {
    return resolveAndValidatePath(p, {
      sandboxRoot: this.root,
      followSymlinks: this.followSymlinks,
    });
  }

  private rel(abs: string): string {
    const r = path.relative(this.root, abs);
    return r === "" ? "." : r;
  }

  async readFile(p: string): Promise<string> {
    return fsp.readFile(this.resolve(p), "utf8");
  }

  async writeFile(p: string, contents: string): Promise<void> {
    const abs = this.resolve(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, contents, "utf8");
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fsp.access(this.resolve(p));
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(p: string): Promise<void> {
    await fsp.rm(this.resolve(p), { force: true });
  }

  async moveFile(from: string, to: string): Promise<void> {
    const a = this.resolve(from);
    const b = this.resolve(to);
    await fsp.mkdir(path.dirname(b), { recursive: true });
    await fsp.rename(a, b);
  }

  async listDir(p: string): Promise<Array<{ name: string; isDir: boolean }>> {
    const abs = this.resolve(p);
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  }

  private async walk(dir: string, out: string[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (this.ignores.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await this.walk(abs, out);
      else if (e.isFile()) out.push(abs);
    }
  }

  async glob(pattern: string): Promise<string[]> {
    const files: string[] = [];
    await this.walk(this.root, files);
    const re = globToRegExp(pattern);
    return files.map((f) => this.rel(f)).filter((r) => re.test(r)).sort();
  }

  async grep(opts: {
    pattern: string;
    glob?: string;
    caseInsensitive?: boolean;
  }): Promise<Array<{ file: string; line: number; text: string }>> {
    const files: string[] = [];
    await this.walk(this.root, files);
    const globRe = opts.glob ? globToRegExp(opts.glob) : null;
    const re = new RegExp(opts.pattern, opts.caseInsensitive ? "i" : undefined);
    const results: Array<{ file: string; line: number; text: string }> = [];
    for (const abs of files) {
      const rel = this.rel(abs);
      if (globRe && !globRe.test(rel)) continue;
      let content: string;
      try {
        content = await fsp.readFile(abs, "utf8");
      } catch {
        continue; // binary or unreadable
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) results.push({ file: rel, line: i + 1, text: lines[i] });
      }
    }
    return results;
  }

  async exec(opts: {
    command: string;
    timeoutMs?: number;
    background?: boolean;
  }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    // Executes within the sandbox root. Command *content* is gated upstream by
    // the policy engine; this method only provides the mechanism.
    return new Promise((resolve) => {
      const child = execFile(
        "bash",
        ["-c", opts.command],
        { cwd: this.root, timeout: opts.timeoutMs ?? 120_000, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const code =
            err && typeof (err as NodeJS.ErrnoException & { code?: number }).code === "number"
              ? ((err as unknown as { code: number }).code as number)
              : err
                ? 1
                : 0;
          resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: code });
        },
      );
      if (opts.background) {
        child.unref?.();
        resolve({ stdout: "", stderr: "", exitCode: null });
      }
    });
  }
}

/** Translate a glob (supporting **, *, ?) into an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** matches across path separators
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // consume trailing slash of **/
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}
