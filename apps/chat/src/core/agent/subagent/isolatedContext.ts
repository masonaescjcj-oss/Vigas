/**
 * subagent/isolatedContext.ts
 * ---------------------------------------------------------------------------
 * A per-subagent isolated overlay of the workspace. Each subagent works only on
 * the files relevant to its subtask, seeded from the base workspace. Writes go
 * to the overlay, never straight to disk, so parallel subagents cannot clobber
 * each other. When a subagent finishes, `changedFiles()` reports exactly what it
 * touched, which the merge step then reconciles.
 * ---------------------------------------------------------------------------
 */

import type { Workspace } from "../toolRegistry.ts";

export interface IsolatedContext {
  /** Files seeded into this context (relPath -> original contents; "" if new). */
  readonly seeded: Record<string, string>;
  read(path: string): string | undefined;
  write(path: string, contents: string): void;
  remove(path: string): void;
  /** Files whose contents differ from the seed (created, edited, or deleted). */
  changedFiles(): Record<string, string | null>;
}

const DELETED = Symbol("deleted");

class MemoryOverlay implements IsolatedContext {
  readonly seeded: Record<string, string>;
  private readonly current = new Map<string, string | typeof DELETED>();

  constructor(seed: Record<string, string>) {
    this.seeded = { ...seed };
    for (const [k, v] of Object.entries(seed)) this.current.set(k, v);
  }

  read(path: string): string | undefined {
    const v = this.current.get(path);
    if (v === undefined || v === DELETED) return undefined;
    return v;
  }

  write(path: string, contents: string): void {
    this.current.set(path, contents);
  }

  remove(path: string): void {
    this.current.set(path, DELETED);
  }

  changedFiles(): Record<string, string | null> {
    const changed: Record<string, string | null> = {};
    for (const [path, val] of this.current.entries()) {
      const original = this.seeded[path];
      if (val === DELETED) {
        if (original !== undefined) changed[path] = null; // deletion of an existing file
      } else if (original === undefined || original !== val) {
        changed[path] = val; // created or modified
      }
    }
    return changed;
  }
}

/**
 * Seed an isolated context from the base workspace for the given file set.
 * Missing files are seeded as absent (a subagent may create them).
 */
export async function createIsolatedContext(
  ws: Workspace,
  files: string[],
): Promise<IsolatedContext> {
  const seed: Record<string, string> = {};
  for (const f of files) {
    if (await ws.exists(f)) {
      try {
        seed[f] = await ws.readFile(f);
      } catch {
        // Unreadable/binary — leave unseeded.
      }
    }
  }
  return new MemoryOverlay(seed);
}
