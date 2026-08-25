/**
 * toolBatching.ts
 * ---------------------------------------------------------------------------
 * Deciding which of a round's tool calls may run at the same time.
 *
 * The loop ran every tool call in sequence — `await` inside `for...of`, so the
 * second file waited for the first to finish before it started. A model that
 * asks for nine files in one round paid nine round trips of latency to do work
 * that had no order to it. With a step budget per turn, that latency is not
 * just slow: it is the reason large builds ran out of room.
 *
 * Running everything at once is the wrong fix. Two writes to one file race, a
 * read after a write in the same round has an order the model intended, and
 * `bash` can do anything at all. So calls are grouped: each group runs
 * concurrently, groups run in order, and a call only joins a group where it
 * cannot conflict.
 *
 * The rules are deliberately pessimistic. Getting this wrong corrupts a file
 * and the user has no way to know; being conservative only costs a little of
 * the speed-up. Anything not recognised runs alone.
 * ---------------------------------------------------------------------------
 */

import type { ToolCall } from "./session/sessionStore.ts";

/**
 * How a tool touches the workspace.
 *
 * - `read`     reads one known path
 * - `readsAll` reads across the tree, so any concurrent write changes what it
 *              would have seen
 * - `write`    writes one known path
 * - `alone`    anything with effects we cannot bound — `bash`, the control-flow
 *              tools that mutate shared runtime state (plan mode, the todo
 *              list, a pending question), `apply_patch` because one envelope
 *              can touch many files, and every unknown tool
 */
type Access =
  | { kind: "read"; path: string }
  | { kind: "readsAll" }
  | { kind: "write"; path: string }
  | { kind: "alone" };

function pathOf(input: Record<string, unknown>): string | null {
  const value = input?.file_path;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function accessOf(call: ToolCall): Access {
  const input = (call.input ?? {}) as Record<string, unknown>;
  switch (call.name) {
    case "read": {
      const path = pathOf(input);
      return path ? { kind: "read", path } : { kind: "alone" };
    }
    case "write":
    case "edit": {
      const path = pathOf(input);
      // No usable path means we cannot prove it does not collide.
      return path ? { kind: "write", path } : { kind: "alone" };
    }
    case "glob":
    case "grep_files":
    case "list_dir":
      return { kind: "readsAll" };
    // apply_patch takes an envelope that can add, edit, delete and move
    // several files at once. Working out which ones would mean parsing the
    // patch here, in a second place, and being wrong about it corrupts files.
    case "apply_patch":
    case "bash":
      return { kind: "alone" };
    default:
      // ask_user, enter_plan_mode, exit_plan_mode, todo_write, task, and
      // anything added later. These mutate state the whole round shares.
      return { kind: "alone" };
  }
}

/**
 * Most tool calls to have in flight at once.
 *
 * Each one is a network round trip to storage or a sandbox. Past a handful
 * they queue anyway, and a burst that large is a good way to get rate-limited
 * by the very backend the files live in.
 */
const MAX_CONCURRENT = 6;

function conflicts(access: Access, group: Access[]): boolean {
  if (access.kind === "alone") return true;
  if (group.some((other) => other.kind === "alone")) return true;

  for (const other of group) {
    // A tree-wide read and any write in the same group would race: the read
    // might see the file before or after, and which one is luck.
    if (access.kind === "readsAll" && other.kind === "write") return true;
    if (access.kind === "write" && other.kind === "readsAll") return true;

    if (access.kind === "write" && (other.kind === "write" || other.kind === "read")) {
      if (other.path === access.path) return true;
    }
    if (access.kind === "read" && other.kind === "write" && other.path === access.path) {
      return true;
    }
  }
  return false;
}

/**
 * Split a round's tool calls into groups that may each run concurrently.
 *
 * Order is preserved: a call never moves ahead of one that came before it, so
 * a model that writes a file and then reads it in the same round still gets
 * the order it asked for.
 *
 * @returns Groups in execution order. Every input call appears exactly once.
 */
export function planToolBatches(calls: readonly ToolCall[]): ToolCall[][] {
  const batches: ToolCall[][] = [];
  let current: ToolCall[] = [];
  let currentAccess: Access[] = [];

  for (const call of calls) {
    const access = accessOf(call);
    if (current.length > 0 && (current.length >= MAX_CONCURRENT || conflicts(access, currentAccess))) {
      batches.push(current);
      current = [];
      currentAccess = [];
    }
    current.push(call);
    currentAccess.push(access);
    // Something with unbounded effects closes the group behind it too.
    if (access.kind === "alone") {
      batches.push(current);
      current = [];
      currentAccess = [];
    }
  }

  if (current.length > 0) batches.push(current);
  return batches;
}
