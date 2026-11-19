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
    // Project files change constantly (agent edits, previews, evals). Any CDN
    // caching causes stale read-after-write: the agent or the preview can see
    // an old version right after an edit. Never cache.
    cacheControl: "0",
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadBlob(client: SupabaseClient, bucket: string, path: string): Promise<Blob> {
  // Supabase's Smart CDN invalidates updated objects asynchronously (up to
  // ~60s), so a plain download right after an upsert can return the previous
  // version — the agent would read stale file contents right after editing.
  // A unique query param makes every read a distinct cache key, forcing the
  // origin. Falls back to the SDK path if the direct fetch is unavailable.
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (base && key) {
    const objectPath = cleanSegment(path).split("/").map(encodeURIComponent).join("/");
    const res = await fetch(
      `${base}/storage/v1/object/authenticated/${bucket}/${objectPath}?cb=${crypto.randomUUID()}`,
      { headers: { Authorization: `Bearer ${key}`, apikey: key } },
    );
    if (res.ok) return await res.blob();
    if (res.status === 404 || res.status === 400) {
      throw new Error(`Storage download failed: file not found (${cleanSegment(path)})`);
    }
    // other statuses: fall through to the SDK client
  }
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
/**
 * Paths that belong to the sandbox and not to the project.
 *
 * Without this, one `npm install` puts every file in node_modules into the
 * user's project: tens of thousands of uploads, one HTTP request each, and a
 * file list nobody can read afterwards. These are all rebuildable from the
 * files that do get kept.
 */
const NOT_THE_PROJECT = [
  "node_modules/",
  ".git/",
  ".next/",
  ".expo/",
  ".cache/",
  ".turbo/",
  "dist/",
  "build/",
  "coverage/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "target/debug/",
  "target/release/",
];

/** True for a path the sandbox owns and the project should never see. */
export function isSandboxOnly(relativePath: string): boolean {
  const path = relativePath.replace(/^\/+/, "");
  return (
    NOT_THE_PROJECT.some((dir) => path === dir.slice(0, -1) || path.startsWith(dir) || path.includes(`/${dir}`)) ||
    path.endsWith(".log") ||
    path.endsWith(".pyc") ||
    path === ".DS_Store" ||
    path.endsWith("/.DS_Store")
  );
}

/**
 * Most files one project may hold.
 *
 * A guard against a listing that got away from us, not a product limit. Nothing
 * a person writes by hand comes near it; anything that does is generated.
 */
const MAX_PROJECT_FILES = 2_000;

export interface SandboxSyncPlan {
  upload: string[];
  remove: string[];
  /** Set when the sync must not run. The reason is worth logging. */
  abort?: string;
  /** Paths left alone because they belong to the sandbox. */
  skipped: number;
}

/**
 * Decide what a sandbox-to-storage sync should actually do.
 *
 * The dangerous half is deletion. The sync mirrors the sandbox, so a file in
 * Storage and not in the sandbox is treated as deleted — which is right when
 * the agent removed it, and catastrophic when the listing is wrong.
 *
 * `listFiles` returns an empty array for a directory that does not exist. If a
 * sandbox is reclaimed, a command is killed part-way, or the work directory is
 * missing for any other reason, the sync would read "no files" as "the user
 * deleted everything" and empty the project. There is no undo for that: the
 * files are the product.
 *
 * So an empty listing against a non-empty project aborts. It is the one case
 * where doing nothing is certainly better than doing what we were told.
 *
 * Pure, so both rules can be tested without a sandbox or a storage bucket.
 */
export function planSandboxSync(opts: {
  /** Paths in the sandbox, relative to the project root. */
  sandboxFiles: string[];
  /** Paths already in Storage, relative to the project root. */
  storageFiles: string[];
}): SandboxSyncPlan {
  const sandboxKept: string[] = [];
  let skipped = 0;
  for (const path of opts.sandboxFiles) {
    if (isSandboxOnly(path)) skipped += 1;
    else sandboxKept.push(path);
  }

  if (sandboxKept.length === 0 && opts.storageFiles.length > 0) {
    return {
      upload: [],
      remove: [],
      skipped,
      abort: "the sandbox listed no project files while the project has some — refusing to treat that as a deletion",
    };
  }

  if (sandboxKept.length > MAX_PROJECT_FILES) {
    return {
      upload: [],
      remove: [],
      skipped,
      abort: `the sandbox listed ${sandboxKept.length} project files, over the ${MAX_PROJECT_FILES} limit`,
    };
  }

  const inSandbox = new Set(sandboxKept);
  return {
    upload: sandboxKept,
    // A path we would never have uploaded is not ours to delete either.
    remove: opts.storageFiles.filter((path) => !inSandbox.has(path) && !isSandboxOnly(path)),
    skipped,
  };
}

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
        // Storage should not be holding these, but a project written before the
        // sync learned to skip them will be. Copying them back in would let the
        // next sync treat them as the project's own.
        if (isSandboxOnly(relative)) continue;
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

    const root = "/home/user/project";
    const strip = (path: string) => path.replace(new RegExp(`^${root}/`), "");

    const sandboxFiles = (await this.opts.sandboxManager.providerListFiles(this.sandbox, root))
      .map(strip)
      .filter((relative) => relative && !relative.includes(".."));

    const basePrefixLength = this.base.length + 1;
    const storageFiles = (await this.files()).map((path) => path.slice(basePrefixLength));

    const plan = planSandboxSync({ sandboxFiles, storageFiles });
    if (plan.abort) {
      // Loud, because this is the sync declining to do what it was told and the
      // user's files are what is at stake either way.
      console.error(`[storage] sandbox sync aborted: ${plan.abort}`);
      return;
    }

    for (const relative of plan.remove) {
      try {
        await this.deleteFile(relative);
      } catch (error) {
        // Keep going: one stuck deletion must not cost the uploads below.
        console.error(`Failed to delete orphaned file ${relative} from Storage:`, error);
      }
    }

    for (const relative of plan.upload) {
      const content = await this.opts.sandboxManager.providerDownloadFile(this.sandbox, `${root}/${relative}`);
      await uploadBlob(this.opts.client, this.opts.bucket, this.full(relative), content);
    }
  }
}
