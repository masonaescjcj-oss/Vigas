/**
 * hooks/defaultHooks.ts
 * ---------------------------------------------------------------------------
 * Practical default hooks:
 *
 *   1. auditLogHook       — records every tool execution (start + end) to an
 *                           AuditSink, e.g. the `agent_tasks` table.
 *   2. realtimeNotifyHook — emits start/end events to a Notifier so the client
 *                           can show live progress ("running bash…", "done").
 *   3. secretGuardHook     — a PreToolUse hook that hard-blocks any attempt to
 *                           read a .env file or private key (defense-in-depth
 *                           alongside the secrets.read policy rule).
 *
 * The sinks are interfaces so they bind to Supabase in production and to
 * in-memory collectors in tests — no placeholders.
 * ---------------------------------------------------------------------------
 */

import type { PostToolUseHook, PreToolUseHook, PreToolUseContext, PostToolUseContext } from "./hookRunner.ts";

/* ---- Pluggable sinks ----------------------------------------------------- */

export interface AuditEntry {
  sessionId: string;
  toolName: string;
  phase: "start" | "end";
  callIndex: number;
  decision?: string;
  ok?: boolean;
  error?: string;
  durationMs?: number;
  at: number; // epoch ms, supplied by caller (keeps this module deterministic)
  /** Short human-readable target of the call (file path, command, pattern) so
   * clients can render "edit index.html" instead of a bare tool name. Never
   * contains file contents. */
  target?: string;
  /** Small numeric result summary for the client UI (lines, +/-, matches). */
  metrics?: Record<string, number>;
  /**
   * Structured payload for the few tools whose whole point is something the
   * user should read: the plan, the checklist.
   *
   * A `target` string cannot carry those — a plan is paragraphs and a checklist
   * is a list with per-item state — and without them the run reads as a stack of
   * opaque tool names. Agent-authored text only, never file contents, so audit
   * rows stay free of user data.
   */
  detail?: PlanDetail | TodoDetail;
}

export interface PlanDetail {
  kind: "plan";
  plan: string;
}

export interface TodoDetail {
  kind: "todos";
  todos: Array<{ subject: string; status: string }>;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void> | void;
}

export interface AgentEvent {
  type: "tool:start" | "tool:end";
  sessionId: string;
  toolName: string;
  callIndex: number;
  ok?: boolean;
  error?: string;
  at: number;
}

export interface Notifier {
  emit(event: AgentEvent): Promise<void> | void;
}

/** Clock injected so hooks stay deterministic and testable. */
export type Clock = () => number;

/* ---- 1. Audit log hook (pre + post) -------------------------------------- */

const TARGET_MAX = 120;

function clip(value: string): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length > TARGET_MAX ? `${single.slice(0, TARGET_MAX - 1)}…` : single;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").filter((line, index, all) => line !== "" || index < all.length - 1).length;
}

/**
 * A short label for what a tool call acted on — the file path, the command, the
 * search pattern. Deliberately never includes file contents so audit rows stay
 * small and free of user data.
 */
export function describeToolTarget(toolName: string, input: Record<string, unknown>): string | undefined {
  const str = (key: string): string | undefined =>
    typeof input[key] === "string" && input[key] ? String(input[key]) : undefined;

  switch (toolName) {
    case "read":
    case "write":
    case "edit":
      return str("file_path") ?? str("path");
    case "apply_patch": {
      const patch = str("patch") ?? "";
      const names = [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => m[1].trim());
      if (names.length === 1) return clip(names[0]);
      if (names.length > 1) return clip(`${names[0]} +${names.length - 1} more`);
      return undefined;
    }
    case "bash":
      return str("command") ? clip(str("command")!) : undefined;
    case "glob":
      return str("pattern");
    case "grep_files": {
      const pattern = str("pattern");
      const glob = str("glob");
      return pattern ? clip(glob ? `${pattern} in ${glob}` : pattern) : undefined;
    }
    case "list_dir":
      return str("path") ?? ".";
    case "task":
      return str("description") ? clip(str("description")!) : undefined;
    // The control-flow tools had no case at all, so they rendered as a bare
    // name with nothing beside it — the user watched "todo_write" happen four
    // times and learned nothing from any of them.
    case "enter_plan_mode":
      return "working out the approach";
    case "exit_plan_mode":
      return "plan ready";
    case "todo_write": {
      const todos = Array.isArray(input.todos) ? input.todos : [];
      const done = todos.filter((t) => (t as { status?: string })?.status === "completed").length;
      return todos.length ? `${done}/${todos.length} done` : undefined;
    }
    case "ask_user": {
      const questions = Array.isArray(input.questions) ? input.questions : [];
      return questions.length
        ? `${questions.length} question${questions.length === 1 ? "" : "s"}`
        : undefined;
    }
    default:
      return str("file_path") ?? str("path") ?? undefined;
  }
}

/**
 * The readable payload behind a control-flow step, when there is one.
 *
 * Only two tools have it. Everything else is adequately described by its target,
 * and attaching more would put file contents in audit rows.
 */
export function describeToolDetail(
  toolName: string,
  input: Record<string, unknown>,
): PlanDetail | TodoDetail | undefined {
  if (toolName === "exit_plan_mode") {
    const plan = typeof input.plan === "string" ? input.plan.trim() : "";
    return plan ? { kind: "plan", plan: plan.slice(0, 4000) } : undefined;
  }
  if (toolName === "todo_write") {
    const raw = Array.isArray(input.todos) ? input.todos : [];
    const todos = raw
      .map((entry) => ({
        subject: String((entry as { subject?: unknown })?.subject ?? "").slice(0, 200),
        status: String((entry as { status?: unknown })?.status ?? "pending"),
      }))
      .filter((entry) => entry.subject);
    // Capped: a runaway list would bloat every row of the transcript.
    return todos.length ? { kind: "todos", todos: todos.slice(0, 30) } : undefined;
  }
  return undefined;
}

/** Numeric summary of a finished call: lines read/written, +/- on edits. */
export function describeToolMetrics(
  toolName: string,
  input: Record<string, unknown>,
  resultContent: string,
): Record<string, number> | undefined {
  const str = (key: string): string => (typeof input[key] === "string" ? String(input[key]) : "");

  switch (toolName) {
    case "read": {
      const lines = countLines(resultContent);
      return lines ? { lines } : undefined;
    }
    case "write": {
      const lines = countLines(str("contents"));
      return lines ? { plus: lines } : undefined;
    }
    case "edit": {
      const plus = countLines(str("new_string"));
      const minus = countLines(str("old_string"));
      return plus || minus ? { plus, minus } : undefined;
    }
    case "apply_patch": {
      const patch = str("patch");
      const plus = (patch.match(/^\+(?!\+\+)/gm) ?? []).length;
      const minus = (patch.match(/^-(?!--)/gm) ?? []).length;
      return plus || minus ? { plus, minus } : undefined;
    }
    case "grep_files": {
      const matches = countLines(resultContent);
      return matches ? { matches } : undefined;
    }
    case "glob":
    case "list_dir": {
      const entries = countLines(resultContent);
      return entries ? { entries } : undefined;
    }
    default:
      return undefined;
  }
}

export function createAuditHooks(sink: AuditSink, clock: Clock): {
  pre: PreToolUseHook;
  post: PostToolUseHook;
} {
  const pre: PreToolUseHook = async (ctx: PreToolUseContext) => {
    await sink.record({
      sessionId: ctx.sessionId,
      toolName: ctx.toolName,
      phase: "start",
      callIndex: ctx.callIndex,
      at: clock(),
      target: describeToolTarget(ctx.toolName, ctx.input),
      detail: describeToolDetail(ctx.toolName, ctx.input),
    });
  };
  const post: PostToolUseHook = async (ctx: PostToolUseContext) => {
    const failed = ctx.result.isError || !!ctx.error;
    await sink.record({
      sessionId: ctx.sessionId,
      toolName: ctx.toolName,
      phase: "end",
      callIndex: ctx.callIndex,
      decision: ctx.decision,
      ok: !failed,
      error: ctx.error ?? (ctx.result.isError ? ctx.result.content : undefined),
      durationMs: ctx.durationMs,
      at: clock(),
      target: describeToolTarget(ctx.toolName, ctx.input),
      metrics: failed ? undefined : describeToolMetrics(ctx.toolName, ctx.input, ctx.result.content ?? ""),
      // Repeated on the end entry because that is the row the client reads back
      // from the transcript; the start row is overwritten by it.
      detail: describeToolDetail(ctx.toolName, ctx.input),
    });
  };
  return { pre, post };
}

/* ---- 2. Realtime notify hook (pre + post) -------------------------------- */

export function createRealtimeHooks(notifier: Notifier, clock: Clock): {
  pre: PreToolUseHook;
  post: PostToolUseHook;
} {
  const pre: PreToolUseHook = async (ctx: PreToolUseContext) => {
    await notifier.emit({
      type: "tool:start",
      sessionId: ctx.sessionId,
      toolName: ctx.toolName,
      callIndex: ctx.callIndex,
      at: clock(),
    });
  };
  const post: PostToolUseHook = async (ctx: PostToolUseContext) => {
    await notifier.emit({
      type: "tool:end",
      sessionId: ctx.sessionId,
      toolName: ctx.toolName,
      callIndex: ctx.callIndex,
      ok: !ctx.result.isError && !ctx.error,
      error: ctx.error ?? (ctx.result.isError ? ctx.result.content : undefined),
      at: clock(),
    });
  };
  return { pre, post };
}

/* ---- 3. Secret guard hook (pre) ------------------------------------------ */

const SECRET_RE =
  /(^|\/)\.env(\.[\w.-]+)?$|(^|\/)id_(rsa|ed25519|ecdsa|dsa)$|(^|\/)\.aws\/credentials$|\.pem$|\.key$|(^|\/)\.ssh\//i;

export const secretGuardHook: PreToolUseHook = (ctx: PreToolUseContext) => {
  const candidates: string[] = [];
  const fp = ctx.input.file_path;
  const p = ctx.input.path;
  if (typeof fp === "string") candidates.push(fp);
  if (typeof p === "string") candidates.push(p);
  if (ctx.toolName === "bash" && typeof ctx.input.command === "string") {
    const m = ctx.input.command.match(/\b(?:cat|less|head|tail|bat|strings)\s+([^\s;|&]+)/i);
    if (m) candidates.push(m[1]);
  }
  for (const c of candidates) {
    if (SECRET_RE.test(c)) {
      return { decision: "deny", reason: `Reading secret file "${c}" is blocked by the secret-guard hook.` };
    }
  }
  return;
};

/* ---- In-memory sink/notifier implementations (used by tests & demos) ----- */

export class InMemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];
  record(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

export class InMemoryNotifier implements Notifier {
  readonly events: AgentEvent[] = [];
  emit(event: AgentEvent): void {
    this.events.push(event);
  }
}
