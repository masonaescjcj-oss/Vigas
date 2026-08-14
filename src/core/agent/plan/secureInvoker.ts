/**
 * plan/secureInvoker.ts
 * ---------------------------------------------------------------------------
 * A reusable tool invoker that runs the SAME security pipeline the main loop
 * uses (PreToolUse hooks -> policy engine -> ask/confirm -> tool -> PostToolUse
 * hooks). Plan-Mode execution and subagents call tools through this so they can
 * never bypass permissions, hooks, or the sandbox.
 *
 * This mirrors loop.executeToolCall without modifying Phase 1/2 code.
 * ---------------------------------------------------------------------------
 */

import type { AgentControl, ToolRegistry, ToolResult, ToolRisk, Workspace } from "../toolRegistry.ts";
import type { PermissionDecision, PolicyEngine } from "../permissions/policyEngine.ts";
import type { HookRunner } from "../hooks/hookRunner.ts";

const STRICTNESS: Record<PermissionDecision, number> = { allow: 0, ask: 1, deny: 2 };

export interface SecureInvokeOutcome {
  result: ToolResult;
  decision: PermissionDecision;
  reason: string;
}

export type SecureInvoke = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<SecureInvokeOutcome>;

export interface SecureInvokerDeps {
  registry: ToolRegistry;
  policy: PolicyEngine;
  hooks: HookRunner;
  workspace: Workspace;
  control: AgentControl & { planMode: boolean };
  root: string;
  sessionId: string;
  profileName: string;
  now: () => number;
  idFactory: () => string;
  confirm?: (req: { toolName: string; input: Record<string, unknown>; reason: string }) => Promise<boolean> | boolean;
  autoApproveAsk?: boolean;
  /** Called with usage side-effects (e.g. increment tool-call counters). */
  onToolCall?: () => void;
}

export function createSecureInvoker(deps: SecureInvokerDeps): SecureInvoke {
  let callIndex = 0;

  return async function invoke(toolName, input) {
    const tool = deps.registry.get(toolName);
    const risk: ToolRisk = tool?.risk ?? "exec";
    const preCtx = {
      sessionId: deps.sessionId,
      toolName,
      risk,
      input,
      sandboxRoot: deps.root,
      profileName: deps.profileName,
      callIndex: callIndex++,
    };

    const hookDecision = await deps.hooks.runPre(preCtx);
    const policyResult = deps.policy.evaluate({ toolName, risk, input });

    let decision: PermissionDecision = policyResult.decision;
    let reason = policyResult.reason;
    if (hookDecision && STRICTNESS[hookDecision.decision] > STRICTNESS[decision]) {
      decision = hookDecision.decision;
      reason = hookDecision.reason;
    }

    if (decision === "ask") {
      const approved = deps.autoApproveAsk
        ? true
        : deps.confirm
          ? await deps.confirm({ toolName, input, reason })
          : false;
      if (approved) {
        decision = "allow";
      } else {
        decision = "deny";
        reason = deps.confirm || deps.autoApproveAsk ? `Declined: ${reason}` : `No confirmation handler; denied (${reason})`;
      }
    }

    const start = deps.now();
    let result: ToolResult;
    let error: string | undefined;

    if (decision === "deny") {
      result = { content: `⛔ Blocked by policy: ${reason}`, isError: true };
    } else {
      try {
        result = await deps.registry.invoke(toolName, input, {
          workspace: deps.workspace,
          control: deps.control,
          root: deps.root,
          planMode: deps.control.planMode,
        });
      } catch (e) {
        error = (e as Error).message;
        result = { content: `Tool error: ${error}`, isError: true };
      }
    }

    const durationMs = deps.now() - start;
    await deps.hooks.runPost({ ...preCtx, decision, result, error, durationMs });
    deps.onToolCall?.();

    return { result, decision, reason };
  };
}
