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
    });
  };
  const post: PostToolUseHook = async (ctx: PostToolUseContext) => {
    await sink.record({
      sessionId: ctx.sessionId,
      toolName: ctx.toolName,
      phase: "end",
      callIndex: ctx.callIndex,
      decision: ctx.decision,
      ok: !ctx.result.isError && !ctx.error,
      error: ctx.error ?? (ctx.result.isError ? ctx.result.content : undefined),
      durationMs: ctx.durationMs,
      at: clock(),
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
