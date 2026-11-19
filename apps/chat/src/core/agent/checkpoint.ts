/**
 * checkpoint.ts
 * ---------------------------------------------------------------------------
 * Lightweight, VCS-free checkpoints of the workspace. A checkpoint is a
 * point-in-time snapshot of every text file under the sandbox root. It lets the
 * runtime roll back a failed or rejected change set without depending on git.
 *
 * (Phase-1 substrate, implemented here so the runtime is complete.)
 * ---------------------------------------------------------------------------
 */

import type { Workspace } from "./toolRegistry.ts";

export interface Checkpoint {
  id: string;
  label: string;
  createdAt: number;
  files: Record<string, string>; // relPath -> contents
}

export interface CheckpointStore {
  create(label: string): Promise<Checkpoint>;
  restore(id: string): Promise<void>;
  list(): Checkpoint[];
  get(id: string): Checkpoint | undefined;
}

/**
 * A Workspace that also exposes an enumerable file list. SandboxFs satisfies
 * this via glob("**"), so we depend only on the public Workspace surface.
 */
export class WorkspaceCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, Checkpoint>();
  private seq = 0;

  constructor(
    private readonly ws: Workspace,
    /** Injected id/clock factories keep snapshots deterministic in tests. */
    private readonly opts: { now: () => number; idFactory?: () => string } = { now: () => 0 },
  ) {}

  private nextId(): string {
    if (this.opts.idFactory) return this.opts.idFactory();
    this.seq += 1;
    return `ckpt_${this.seq}`;
  }

  async create(label: string): Promise<Checkpoint> {
    const paths = await this.ws.glob("**");
    const files: Record<string, string> = {};
    for (const p of paths) {
      try {
        files[p] = await this.ws.readFile(p);
      } catch {
        // Skip unreadable/binary files.
      }
    }
    const ckpt: Checkpoint = { id: this.nextId(), label, createdAt: this.opts.now(), files };
    this.checkpoints.set(ckpt.id, ckpt);
    return ckpt;
  }

  async restore(id: string): Promise<void> {
    const ckpt = this.checkpoints.get(id);
    if (!ckpt) throw new Error(`Unknown checkpoint: ${id}`);

    // 1) Remove files that did not exist at checkpoint time.
    const current = await this.ws.glob("**");
    for (const p of current) {
      if (!(p in ckpt.files)) await this.ws.deleteFile(p);
    }
    // 2) Restore snapshotted contents.
    for (const [p, contents] of Object.entries(ckpt.files)) {
      await this.ws.writeFile(p, contents);
    }
  }

  list(): Checkpoint[] {
    return [...this.checkpoints.values()];
  }

  get(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }
}
