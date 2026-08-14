import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "../../../src/core/agent/toolRegistry.ts";
import type { SandboxManager, SandboxSession } from "../../../src/infra/sandbox/sandboxManager.ts";

export const PROJECT_FILES_BUCKET = Deno.env.get("PROJECT_FILES_BUCKET") ?? "project-files";
export const CHECKPOINTS_BUCKET = Deno.env.get("CHECKPOINTS_BUCKET") ?? "agent-checkpoints";

function cleanSegment(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

export function joinStoragePath(...parts: string[]): string {
  return parts.map(cleanSegment).filter(Boolean).join("/");
}

export interface StorageFile {
  path: string;
  data: Blob;
}

export async function listStorageFiles(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const result: string[] = [];
  const pending = [cleanSegment(prefix)];
  while (pending.length) {
    const directory = pending.shift()!;
    let offset = 0;
    while (true) {
      const { data, error } = await client.storage.from(bucket).list(directory, {
        limit: 1_000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`Storage list failed: ${error.message}`);
      const entries = data ?? [];
      for (const entry of entries) {
        const child = joinStoragePath(directory, entry.name);
        if (entry.id === null) pending.push(child);
        else result.push(child);
      }
      if (entries.length < 1_000) break;
      offset += entries.length;
    }
  }
  return result;
}

export async function removeStoragePrefix(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<void> {
  const files = await listStorageFiles(client, bucket, prefix);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await client.storage.from(bucket).remove(files.slice(i, i + 100));
    if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
  }
}

export async function uploadBlob(
  client: SupabaseClient,
  bucket: string,
  path: string,
  data: Blob | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(cleanSegment(path), data, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadBlob(client: SupabaseClient, bucket: string, path: string): Promise<Blob> {
  const { data, error } = await client.storage.from(bucket).download(cleanSegment(path));
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "file not found"}`);
  return data;
}

export async function storageFileMap(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<StorageFile[]> {
  const paths = await listStorageFiles(client, bucket, prefix);
  const files: StorageFile[] = [];
  for (const path of paths) files.push({ path, data: await downloadBlob(client, bucket, path) });
  return files;
}

export interface StorageWorkspaceOptions {
  client: SupabaseClient;
  bucket: string;
  prefix: string;
  projectId: string;
  userId: string;
  sessionId?: string;
  sandboxManager?: SandboxManager;
}

function globToRegExp(glob: string): RegExp {
  let expression = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") { expression += ".*"; i += 1; if (glob[i + 1] === "/") i += 1; }
      else expression += "[^/]*";
    } else if (char === "?") expression += "[^/]";
    else expression += ".+^${}()|[]\\".includes(char) ? `\\${char}` : char;
  }
  return new RegExp(`${expression}$`);
}

/** Storage-backed Workspace used by Edge Functions; no service key reaches the model. */
export class StorageWorkspace implements Workspace {
  readonly root: string;
  private readonly base: string;
  private sandbox?: SandboxSession;
  constructor(private readonly opts: StorageWorkspaceOptions) {
    this.base = cleanSegment(opts.prefix);
    this.root = `/${this.base}`;
  }

  private relative(path: string): string {
    const value = cleanSegment(path);
    const base = cleanSegment(this.base);
    if (value === "." || value === "") return "";
    const relative = value === base ? "" : value.startsWith(`${base}/`) ? value.slice(base.length + 1) : value;
    if (relative.split("/").some((part) => !part || part === "." || part === "..")) {
      if (relative !== "") throw new Error("Workspace path is outside the project sandbox.");
    }
    return relative;
  }

  private full(path: string): string { return joinStoragePath(this.base, this.relative(path)); }
  private async files(): Promise<string[]> { return listStorageFiles(this.opts.client, this.opts.bucket, this.base); }

  async readFile(path: string): Promise<string> { return await (await downloadBlob(this.opts.client, this.opts.bucket, this.full(path))).text(); }
  async writeFile(path: string, contents: string): Promise<void> {
    await uploadBlob(this.opts.client, this.opts.bucket, this.full(path), contents, "text/plain; charset=utf-8");
  }
  async exists(path: string): Promise<boolean> {
    try { await downloadBlob(this.opts.client, this.opts.bucket, this.full(path)); return true; } catch { return false; }
  }
  async deleteFile(path: string): Promise<void> {
    const { error } = await this.opts.client.storage.from(this.opts.bucket).remove([this.full(path)]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
  async moveFile(from: string, to: string): Promise<void> {
    const source = await downloadBlob(this.opts.client, this.opts.bucket, this.full(from));
    await uploadBlob(this.opts.client, this.opts.bucket, this.full(to), source, source.type || "application/octet-stream");
    await this.deleteFile(from);
  }
  async listDir(path: string): Promise<Array<{ name: string; isDir: boolean }>> {
    const directory = this.full(path);
    const { data, error } = await this.opts.client.storage.from(this.opts.bucket).list(directory, {
      limit: 1_000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    return (data ?? []).map((entry) => ({ name: entry.name, isDir: entry.id === null }));
  }
  async glob(pattern: string): Promise<string[]> {
    const base = this.base.length + 1;
    const re = globToRegExp(pattern);
    return (await this.files()).map((path) => path.slice(base)).filter((path) => re.test(path));
  }
  async grep(opts: { pattern: string; glob?: string; caseInsensitive?: boolean }): Promise<Array<{ file: string; line: number; text: string }>> {
    const files = await this.glob(opts.glob ?? "**");
    const expression = new RegExp(opts.pattern, opts.caseInsensitive ? "i" : "");
    const matches: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      let text: string;
      try { text = await this.readFile(file); } catch { continue; }
      for (const [index, line] of text.split("\n").entries()) if (expression.test(line)) matches.push({ file, line: index + 1, text: line });
    }
    return matches;
  }
  async exec(opts: { command: string; timeoutMs?: number; background?: boolean }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    if (this.opts.sandboxManager && this.opts.sessionId) {
      this.sandbox ??= await this.opts.sandboxManager.acquire(this.opts.userId, this.opts.projectId, this.opts.sessionId);
      const storageFiles = await storageFileMap(this.opts.client, this.opts.bucket, this.base);
      for (const file of storageFiles) {
        const relative = file.path.slice(this.base.length + 1);
        await this.opts.sandboxManager.providerUploadFile(this.sandbox, `/home/user/project/${relative}`, new Uint8Array(await file.data.arrayBuffer()));
      }
      const result = await this.opts.sandboxManager.runCommand(this.sandbox, opts.command, { timeoutMs: opts.timeoutMs });
      await this.syncSandboxFiles();
      return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    }
    return { stdout: "", stderr: "The E2B SandboxManager is not configured for this runtime.", exitCode: 127 };
  }

  private async syncSandboxFiles(): Promise<void> {
    if (!this.sandbox || !this.opts.sandboxManager) return;
    
    // 1. Get the list of files currently in the sandbox
    const remoteFiles = await this.opts.sandboxManager.providerListFiles(this.sandbox, "/home/user/project");
    const sandboxRelativeFiles = new Set(
      remoteFiles
        .map((p) => p.replace(/^\/home\/user\/project\//, ""))
        .filter((r) => r && !r.includes(".."))
    );

    // 2. Get the list of files currently in Storage (relative to base)
    const storagePaths = await this.files();
    const basePrefixLength = this.base.length + 1;
    const storageRelativeFiles = storagePaths.map((p) => p.slice(basePrefixLength));

    // 3. Delete files from Storage that were deleted in Sandbox
    for (const relative of storageRelativeFiles) {
      if (!sandboxRelativeFiles.has(relative)) {
        try {
          await this.deleteFile(relative);
        } catch (error) {
          // Log and continue if a deletion fails, so we don't block the rest of sync
          console.error(`Failed to delete orphaned file ${relative} from Storage:`, error);
        }
      }
    }

    // 4. Download and upload all remote files to Storage
    for (const remotePath of remoteFiles) {
      const relative = remotePath.replace(/^\/home\/user\/project\//, "");
      if (!relative || relative.includes("..")) continue;
      const content = await this.opts.sandboxManager.providerDownloadFile(this.sandbox, remotePath);
      await uploadBlob(this.opts.client, this.opts.bucket, this.full(relative), content);
    }
  }
}
