/**
 * Rollback deletes the project's files before writing a snapshot back, so the
 * guards around it are the difference between "undo" and "data loss". These
 * drive createCheckpoint/restoreCheckpoint against an in-memory Storage and
 * database double.
 */
import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import {
  createCheckpoint,
  MAX_SNAPSHOT_FILES,
  pruneCheckpoints,
  restoreCheckpoint,
} from "../shared/checkpoints.ts";

const SANDBOX = "users/u1/projects/p1";

interface Row { id: string; project_id: string; session_id: string | null; snapshot_path: string; created_at: string }

/**
 * Enough of the Supabase client for these paths: two buckets of blobs, a
 * checkpoints table and a projects table.
 */
function makeClient(initialFiles: Record<string, string>) {
  const buckets: Record<string, Map<string, Blob>> = {
    "project-files": new Map(),
    "agent-checkpoints": new Map(),
  };
  for (const [path, body] of Object.entries(initialFiles)) {
    buckets["project-files"].set(path, new Blob([body], { type: "text/plain" }));
  }
  const checkpoints: Row[] = [];
  let clock = 0;

  const storage = {
    from(bucket: string) {
      const map = buckets[bucket];
      return {
        list(prefix: string) {
          // Return only immediate children, mirroring Storage's directory view.
          const dirs = new Set<string>();
          const files: Array<{ name: string; id: string | null }> = [];
          for (const key of map.keys()) {
            if (prefix && !key.startsWith(`${prefix}/`)) continue;
            const rest = prefix ? key.slice(prefix.length + 1) : key;
            const slash = rest.indexOf("/");
            if (slash === -1) files.push({ name: rest, id: "f" });
            else dirs.add(rest.slice(0, slash));
          }
          const data = [...[...dirs].map((name) => ({ name, id: null })), ...files];
          return Promise.resolve({ data, error: null });
        },
        upload(path: string, data: Blob | string) {
          map.set(path, typeof data === "string" ? new Blob([data], { type: "application/json" }) : data);
          return Promise.resolve({ error: null });
        },
        download(path: string) {
          const blob = map.get(path);
          return Promise.resolve(blob ? { data: blob, error: null } : { data: null, error: { message: "not found" } });
        },
        remove(paths: string[]) {
          for (const path of paths) map.delete(path);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  function table(name: string) {
    const state: { filters: Record<string, string>; rows: Row[] } = { filters: {}, rows: checkpoints };
    const api: any = {
      select: () => api,
      eq: (column: string, value: string) => { state.filters[column] = value; return api; },
      order: () => api,
      insert: (row: Partial<Row>) => {
        const created: Row = {
          id: String(row.id),
          project_id: String(row.project_id),
          session_id: row.session_id ?? null,
          snapshot_path: String(row.snapshot_path),
          created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString(),
        };
        checkpoints.push(created);
        return { select: () => ({ single: () => Promise.resolve({ data: created, error: null }) }) };
      },
      delete: () => ({
        eq: (_column: string, value: string) => {
          const index = checkpoints.findIndex((row) => row.id === value);
          if (index >= 0) checkpoints.splice(index, 1);
          return Promise.resolve({ error: null });
        },
      }),
      maybeSingle: () => {
        if (name === "projects") return Promise.resolve({ data: { sandbox_path: SANDBOX }, error: null });
        const found = checkpoints.find((row) => row.id === state.filters.id) ?? null;
        return Promise.resolve({ data: found, error: null });
      },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => {
        const rows = checkpoints
          .filter((row) => !state.filters.project_id || row.project_id === state.filters.project_id)
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return api;
  }

  return { client: { storage, from: table } as any, buckets, checkpoints };
}

const projectFile = (name: string) => `${SANDBOX}/${name}`;

Deno.test("createCheckpoint copies every file and records a row", async () => {
  const { client, buckets, checkpoints } = makeClient({
    [projectFile("index.html")]: "<h1>v1</h1>",
    [projectFile("src/app.js")]: "console.log(1)",
  });

  const result = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  assertEquals(result.created, true);
  if (!result.created) return;
  assertEquals(result.fileCount, 2);
  assertEquals(checkpoints.length, 1);

  const snapshot = [...buckets["agent-checkpoints"].keys()];
  assertEquals(snapshot.filter((key) => key.endsWith(".manifest.json")).length, 1);
  assertEquals(snapshot.filter((key) => key.endsWith("index.html")).length, 1);
  assertEquals(snapshot.filter((key) => key.endsWith("src/app.js")).length, 1);
});

Deno.test("an empty project is reported, not snapshotted", async () => {
  const { client, checkpoints } = makeClient({});
  const result = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  assertEquals(result.created, false);
  if (result.created) return;
  assertEquals(result.reason, "empty");
  assertEquals(checkpoints.length, 0);
});

Deno.test("a project with too many files is skipped rather than half-copied", async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i <= MAX_SNAPSHOT_FILES; i++) files[projectFile(`f${i}.txt`)] = "x";
  const { client, checkpoints } = makeClient(files);

  const result = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  assertEquals(result.created, false);
  if (result.created) return;
  assertEquals(result.reason, "too_large");
  assertEquals(checkpoints.length, 0);
});

Deno.test("restore puts the snapshot back and removes files added since", async () => {
  const { client, buckets } = makeClient({ [projectFile("index.html")]: "<h1>v1</h1>" });
  const snapshot = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  assertEquals(snapshot.created, true);
  if (!snapshot.created) return;

  // The agent then edits one file and adds another.
  buckets["project-files"].set(projectFile("index.html"), new Blob(["<h1>v2</h1>"]));
  buckets["project-files"].set(projectFile("extra.js"), new Blob(["oops"]));

  const result = await restoreCheckpoint(client, snapshot.checkpoint.id);
  assertEquals(result.filesRestored, 1);
  assertEquals(await buckets["project-files"].get(projectFile("index.html"))!.text(), "<h1>v1</h1>");
  assertEquals(buckets["project-files"].has(projectFile("extra.js")), false);
});

Deno.test("restore takes a safety snapshot first, so it can be undone", async () => {
  const { client, buckets } = makeClient({ [projectFile("index.html")]: "<h1>v1</h1>" });
  const first = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  if (!first.created) throw new Error("setup failed");

  buckets["project-files"].set(projectFile("index.html"), new Blob(["<h1>v2</h1>"]));

  const rollback = await restoreCheckpoint(client, first.checkpoint.id);
  assertEquals(typeof rollback.safetyCheckpointId, "string");
  assertEquals(await buckets["project-files"].get(projectFile("index.html"))!.text(), "<h1>v1</h1>");

  // Undo the undo: v2 comes back.
  await restoreCheckpoint(client, rollback.safetyCheckpointId!);
  assertEquals(await buckets["project-files"].get(projectFile("index.html"))!.text(), "<h1>v2</h1>");
});

Deno.test("a snapshot missing files is refused instead of destroying the project", async () => {
  const { client, buckets } = makeClient({
    [projectFile("index.html")]: "<h1>v1</h1>",
    [projectFile("app.js")]: "console.log(1)",
  });
  const snapshot = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  if (!snapshot.created) throw new Error("setup failed");

  // Simulate a snapshot object going missing after the fact.
  const target = [...buckets["agent-checkpoints"].keys()].find((key) => key.endsWith("app.js"))!;
  buckets["agent-checkpoints"].delete(target);

  const error = await assertRejects(() => restoreCheckpoint(client, snapshot.checkpoint.id));
  assertStringIncludes(String((error as { message?: string }).message ?? error), "missing");
  // The project must be untouched.
  assertEquals(buckets["project-files"].size, 2);
});

Deno.test("a snapshot with no manifest is treated as unverifiable", async () => {
  const { client, buckets } = makeClient({ [projectFile("index.html")]: "<h1>v1</h1>" });
  const snapshot = await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  if (!snapshot.created) throw new Error("setup failed");

  const manifest = [...buckets["agent-checkpoints"].keys()].find((key) => key.endsWith(".manifest.json"))!;
  buckets["agent-checkpoints"].delete(manifest);

  const error = await assertRejects(() => restoreCheckpoint(client, snapshot.checkpoint.id));
  assertStringIncludes(String((error as { message?: string }).message ?? error), "manifest");
  assertEquals(buckets["project-files"].size, 1);
});

Deno.test("pruning keeps the newest snapshots and deletes the rest from storage", async () => {
  const { client, buckets, checkpoints } = makeClient({ [projectFile("index.html")]: "<h1>v1</h1>" });
  for (let i = 0; i < 4; i++) {
    await createCheckpoint(client, { projectId: "p1", sandboxPath: SANDBOX });
  }
  assertEquals(checkpoints.length, 4);

  const removed = await pruneCheckpoints(client, "p1", 2);
  assertEquals(removed, 2);
  assertEquals(checkpoints.length, 2);
  // Two snapshots' worth of objects remain: one file + one manifest each.
  assertEquals(buckets["agent-checkpoints"].size, 4);
});
