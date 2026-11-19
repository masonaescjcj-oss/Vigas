/**
 * sandbox/pathGuard.ts
 * ---------------------------------------------------------------------------
 * Path confinement for the agent sandbox.
 *
 * Every filesystem operation performed by a tool must first pass its target
 * path through `resolveAndValidatePath`. The function returns an absolute,
 * normalized path that is provably inside the sandbox root, or throws
 * `PathGuardError`. It defends against:
 *
 *   - relative traversal: "../../etc/passwd", "a/../../b"
 *   - absolute escapes:   "/etc/passwd", "C:\\Windows\\..."
 *   - NUL-byte injection:  "foo\0.txt"
 *   - symlink escapes:     a path whose real (symlink-resolved) location lands
 *                          outside the root, even when the textual path looks
 *                          contained.
 *
 * The guard is filesystem-aware only for the symlink check: it resolves the
 * deepest existing ancestor with `realpathSync` and confirms that real
 * location is still within the (also real-resolved) root. Non-existent leaf
 * segments (e.g. a file about to be created) are validated textually against
 * that real ancestor.
 * ---------------------------------------------------------------------------
 */

import * as path from "node:path";
import * as fs from "node:fs";

export class PathGuardError extends Error {
  constructor(
    message: string,
    readonly attempted: string,
    readonly root: string,
  ) {
    super(message);
    this.name = "PathGuardError";
  }
}

/** Returns the real path of the deepest ancestor of `absPath` that exists. */
function realpathOfNearestExistingAncestor(absPath: string): string {
  let current = absPath;
  // Walk up until an existing path is found (root always exists).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(current)) {
      try {
        return fs.realpathSync(current);
      } catch {
        // Broken symlink at this level — treat its parent as the anchor.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return current; // reached filesystem root
    current = parent;
  }
}

function isInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export interface PathGuardOptions {
  /** Absolute sandbox root. All access is confined to this subtree. */
  sandboxRoot: string;
  /**
   * When true, the guard also rejects paths that resolve (via symlink) outside
   * the root. Enabled by default; disable only in pure in-memory tests where no
   * real filesystem exists.
   */
  followSymlinks?: boolean;
}

/**
 * Resolve `target` (relative to the sandbox root, or absolute) and validate it
 * is confined to the sandbox. Throws {@link PathGuardError} otherwise.
 *
 * @returns the normalized absolute path, safe to hand to fs operations.
 */
export function resolveAndValidatePath(
  target: string,
  opts: PathGuardOptions,
): string {
  const followSymlinks = opts.followSymlinks !== false;

  if (typeof target !== "string" || target.length === 0) {
    throw new PathGuardError("Empty path is not allowed.", String(target), opts.sandboxRoot);
  }
  if (target.includes("\0")) {
    throw new PathGuardError("Path contains a NUL byte.", target, opts.sandboxRoot);
  }

  const root = path.resolve(opts.sandboxRoot);

  // Absolute inputs must already be inside root; relative inputs join to root.
  const joined = path.isAbsolute(target) ? path.resolve(target) : path.resolve(root, target);
  const normalized = path.normalize(joined);

  // 1) Textual containment check (catches ../ and absolute escapes).
  if (!isInside(normalized, root)) {
    throw new PathGuardError(
      `Path escapes the sandbox root (${normalized} is outside ${root}).`,
      target,
      root,
    );
  }

  // 2) Symlink-aware containment: resolve the real location of the deepest
  //    existing ancestor and re-check. This catches a symlink inside the
  //    sandbox that points outside it.
  if (followSymlinks) {
    let realRoot: string;
    try {
      realRoot = fs.realpathSync(root);
    } catch {
      realRoot = root; // root itself must exist in practice; fall back textually
    }
    const realAncestor = realpathOfNearestExistingAncestor(normalized);
    // Re-append the not-yet-existing tail (if any) to the real ancestor.
    const anchorForTail = fs.existsSync(normalized) ? normalized : realpathAnchorBase(normalized);
    const tail = path.relative(anchorForTail, normalized);
    const realFinal = tail && !tail.startsWith("..")
      ? path.join(realAncestor, tail)
      : realAncestor;

    if (!isInside(realFinal, realRoot)) {
      throw new PathGuardError(
        `Path resolves (via symlink) outside the sandbox root: ${realFinal} not in ${realRoot}.`,
        target,
        realRoot,
      );
    }
  }

  return normalized;
}

/** The deepest existing ancestor directory of a (possibly non-existent) path. */
function realpathAnchorBase(absPath: string): string {
  let current = absPath;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
}

/** Convenience: true if `target` is safely inside the sandbox (no throw). */
export function isPathAllowed(target: string, opts: PathGuardOptions): boolean {
  try {
    resolveAndValidatePath(target, opts);
    return true;
  } catch {
    return false;
  }
}
