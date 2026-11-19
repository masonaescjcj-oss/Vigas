/**
 * hooks/hookRunner.ts
 * ---------------------------------------------------------------------------
 * Lifecycle hooks around tool execution. Unlike the upstream design, hooks here
 * are in-process TypeScript callbacks — NOT external shell scripts. Nothing on
 * disk is executed and no ambient system access is granted. This keeps the
 * runtime safe to embed in a mobile/server context.
 *
 *   PreToolUse  hooks: run before the permission decision is finalized. A hook
 *                      may observe the call and optionally return a decision
 *                      (allow/ask/deny) that is merged with the policy engine's
 *                      result using strictest-wins precedence.
 *   PostToolUse hooks: run after the tool finishes (success or error). Purely
 *                      observational (logging, notifications, metrics).
 * ---------------------------------------------------------------------------
 */

import type { ToolResult, ToolRisk } from "../toolRegistry.ts";
import type { PermissionDecision } from "../permissions/policyEngine.ts";

export interface PreToolUseContext {
  sessionId: string;
  toolName: string;
  risk: ToolRisk;
  input: Record<string, unknown>;
  sandboxRoot: string;
  profileName: string;
  /** Monotonic index of this tool call within the session. */
  callIndex: number;
}

export interface PostToolUseContext extends PreToolUseContext {
  decision: PermissionDecision;
  result: ToolResult;
  error?: string;
  durationMs: number;
}

/** A PreToolUse hook may abstain (void) or nudge the decision. */
export type PreToolUseHook = (
  ctx: PreToolUseContext,
) => Promise<{ decision?: PermissionDecision; reason?: string } | void> | { decision?: PermissionDecision; reason?: string } | void;

export type PostToolUseHook = (ctx: PostToolUseContext) => Promise<void> | void;

export interface HookSet {
  preToolUse?: PreToolUseHook[];
  postToolUse?: PostToolUseHook[];
}

const STRICTNESS: Record<PermissionDecision, number> = { allow: 0, ask: 1, deny: 2 };

export class HookRunner {
  private readonly pre: PreToolUseHook[];
  private readonly post: PostToolUseHook[];

  constructor(hooks: HookSet = {}) {
    this.pre = hooks.preToolUse ?? [];
    this.post = hooks.postToolUse ?? [];
  }

  addPre(hook: PreToolUseHook): void {
    this.pre.push(hook);
  }
  addPost(hook: PostToolUseHook): void {
    this.post.push(hook);
  }

  /**
   * Run all PreToolUse hooks. Returns the strictest decision any hook requested
   * (or null if none expressed an opinion).
   */
  async runPre(ctx: PreToolUseContext): Promise<{ decision: PermissionDecision; reason: string } | null> {
    let winner: { decision: PermissionDecision; reason: string } | null = null;
    for (const hook of this.pre) {
      const out = await hook(ctx);
      if (out && out.decision) {
        if (!winner || STRICTNESS[out.decision] >= STRICTNESS[winner.decision]) {
          winner = { decision: out.decision, reason: out.reason ?? `Hook requested ${out.decision}.` };
        }
      }
    }
    return winner;
  }

  /** Run all PostToolUse hooks. Hook errors are swallowed (best-effort). */
  async runPost(ctx: PostToolUseContext): Promise<void> {
    for (const hook of this.post) {
      try {
        await hook(ctx);
      } catch {
        // Observational hooks must never break the run.
      }
    }
  }
}
