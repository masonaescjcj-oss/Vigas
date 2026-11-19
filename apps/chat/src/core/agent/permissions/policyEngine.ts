/**
 * permissions/policyEngine.ts
 * ---------------------------------------------------------------------------
 * The decision engine that runs *before* every tool execution.
 *
 * Pipeline position:  PreToolUse hook -> policyEngine.evaluate() -> (ask?) ->
 * tool execution -> PostToolUse hook.
 *
 * The engine extracts the concrete effects of a tool call (which paths it
 * touches, which shell command it would run), then runs an ordered list of
 * rules. Each rule may return allow / ask / deny, or abstain. The engine
 * combines results by strictest-wins precedence: deny > ask > allow. If no
 * rule matches, a profile-derived default applies.
 * ---------------------------------------------------------------------------
 */

import type { ToolRisk } from "../toolRegistry.ts";
import { parsePatch } from "../toolRegistry.ts";
import type { SandboxProfile } from "../sandbox/profiles.ts";

export type PermissionDecision = "allow" | "ask" | "deny";

export interface ToolCallEvaluation {
  toolName: string;
  risk: ToolRisk;
  input: Record<string, unknown>;
  /** Concrete filesystem paths the call targets (extracted from input). */
  targetPaths: string[];
  /** For shell tools: the raw command string. */
  command?: string;
  profile: SandboxProfile;
  sandboxRoot: string;
  /** Hostnames the agent is allowed to reach from shell commands. */
  networkAllowlist: string[];
  /** Whether containment checks may resolve symlinks on the host filesystem. */
  followSymlinks: boolean;
}

export interface PermissionRule {
  id: string;
  description: string;
  /** Return a decision if the rule applies, or null to abstain. */
  evaluate(ev: ToolCallEvaluation): { decision: PermissionDecision; reason: string } | null;
}

export interface PermissionResult {
  decision: PermissionDecision;
  reason: string;
  ruleId: string | null;
}

const STRICTNESS: Record<PermissionDecision, number> = { allow: 0, ask: 1, deny: 2 };

/** Extract concrete target paths from a tool call's input. */
export function extractTargetPaths(toolName: string, input: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const pushIfString = (v: unknown) => {
    if (typeof v === "string" && v.length > 0) paths.push(v);
  };
  switch (toolName) {
    case "read":
    case "write":
    case "edit":
      pushIfString(input.file_path);
      break;
    case "list_dir":
      pushIfString(input.path);
      break;
    case "apply_patch":
      if (typeof input.patch === "string") {
        try {
          for (const op of parsePatch(input.patch)) {
            paths.push(op.path);
            if (op.kind === "update" && op.moveTo) paths.push(op.moveTo);
          }
        } catch {
          // Malformed patch: let the tool itself report the parse error.
        }
      }
      break;
    default:
      break;
  }
  return paths;
}

/** Extract the shell command from a shell tool call, if any. */
export function extractCommand(toolName: string, input: Record<string, unknown>): string | undefined {
  if (toolName === "bash" && typeof input.command === "string") return input.command;
  return undefined;
}

export interface PolicyEngineConfig {
  profile: SandboxProfile;
  sandboxRoot: string;
  rules: PermissionRule[];
  networkAllowlist?: string[];
  /**
   * Resolve symlinks on the host filesystem when checking sandbox containment.
   * Defaults to true (correct for a real on-disk workspace). Set false for a
   * virtual workspace — e.g. Storage-backed — where sandbox paths do not exist
   * on the host and resolving them against the real filesystem produces false
   * denials. The textual containment check still blocks `../` escapes.
   */
  followSymlinks?: boolean;
  /**
   * Default decision when no rule matches, keyed by risk. Sensible defaults are
   * provided; callers may override (e.g. make "exec" allow in trusted CI).
   */
  defaultByRisk?: Partial<Record<ToolRisk, PermissionDecision>>;
}

const BUILTIN_DEFAULTS: Record<ToolRisk, PermissionDecision> = {
  read: "allow",
  local: "allow",
  exec: "ask",
  external: "ask",
};

export class PolicyEngine {
  private readonly rules: PermissionRule[];
  private readonly defaults: Record<ToolRisk, PermissionDecision>;

  constructor(private readonly config: PolicyEngineConfig) {
    this.rules = config.rules;
    this.defaults = { ...BUILTIN_DEFAULTS, ...(config.defaultByRisk ?? {}) };
  }

  get ruleCount(): number {
    return this.rules.length;
  }

  /** Evaluate a single tool call and return the combined decision. */
  evaluate(params: {
    toolName: string;
    risk: ToolRisk;
    input: Record<string, unknown>;
  }): PermissionResult {
    const ev: ToolCallEvaluation = {
      toolName: params.toolName,
      risk: params.risk,
      input: params.input,
      targetPaths: extractTargetPaths(params.toolName, params.input),
      command: extractCommand(params.toolName, params.input),
      profile: this.config.profile,
      sandboxRoot: this.config.sandboxRoot,
      networkAllowlist: this.config.networkAllowlist ?? [],
      followSymlinks: this.config.followSymlinks !== false,
    };

    // Strictest-wins among *matching* rules. The per-risk default applies only
    // as a baseline when no rule expresses an opinion — so an explicit rule
    // (e.g. an allow-listed network fetch) can override the default.
    let winner: PermissionResult | null = null;

    for (const rule of this.rules) {
      let outcome: { decision: PermissionDecision; reason: string } | null = null;
      try {
        outcome = rule.evaluate(ev);
      } catch (e) {
        // A throwing rule fails closed.
        outcome = { decision: "deny", reason: `Rule ${rule.id} errored: ${(e as Error).message}` };
      }
      if (!outcome) continue;
      if (!winner || STRICTNESS[outcome.decision] >= STRICTNESS[winner.decision]) {
        winner = { decision: outcome.decision, reason: outcome.reason, ruleId: rule.id };
      }
      // Short-circuit: nothing is stricter than deny.
      if (winner.decision === "deny") break;
    }

    if (!winner) {
      return {
        decision: this.defaults[params.risk] ?? "ask",
        reason: `Default policy for ${params.risk} tools.`,
        ruleId: null,
      };
    }
    return winner;
  }
}
