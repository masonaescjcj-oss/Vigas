/**
 * core/agent/index.ts
 * ---------------------------------------------------------------------------
 * Single entry point that composes every layer into one runtime:
 *
 *   Phase 1 : tool registry, workspace (sandbox filesystem), checkpoints, loop
 *   Phase 2 : sandbox profiles + pathGuard, permission engine + rules,
 *             lifecycle hooks, and session management
 *
 * `createAgentRuntime(options)` returns an object exposing:
 *   - run(prompt, options?)            drive a task to completion
 *   - resumeSession(sessionId)         reload a paused session to continue it
 *   - forkSession(sessionId, atIndex)  branch a session at a message
 *   - getUsage(sessionId?)             token/tool usage for a session
 * plus session listing, export, and checkpoint helpers.
 * ---------------------------------------------------------------------------
 */

import {
  createToolRegistry,
  type ToolDefinition,
  type Workspace,
} from "./toolRegistry.ts";
import { buildSystemPrompt } from "./systemPrompt.ts";
import { SandboxFs } from "./workspace/sandboxFs.ts";
import { WorkspaceCheckpointStore, type Checkpoint } from "./checkpoint.ts";
import { getProfile, type SandboxProfileName } from "./sandbox/profiles.ts";
import { PolicyEngine, type PermissionRule } from "./permissions/policyEngine.ts";
import { DEFAULT_RULES } from "./permissions/rules.ts";
import { HookRunner, type HookSet } from "./hooks/hookRunner.ts";
import {
  createAuditHooks,
  createRealtimeHooks,
  secretGuardHook,
  InMemoryAuditSink,
  InMemoryNotifier,
  type AuditSink,
  type Notifier,
} from "./hooks/defaultHooks.ts";
import {
  InMemorySessionStore,
  emptyUsage,
  type AgentSession,
  type AgentSessionSummary,
  type ChatMessage,
  type SessionPersistence,
  type UsageStats,
} from "./session/sessionStore.ts";
import { compactHistory, type Summarizer } from "./session/compact.ts";
import type { ClarifyRequest } from "./clarify.ts";
import type { StopReason } from "./loop.ts";
import { forkSession as forkSessionOp, resumeSession as resumeSessionOp } from "./session/forkResume.ts";
import { exportSession, exportSessionToJson, type ExportedSession } from "./session/exporter.ts";
import {
  runAgentLoop,
  RuntimeControl,
  type ChatModel,
  type ConfirmFn,
  type LoopDeps,
} from "./loop.ts";
import { generatePlan, modelPlanSource, type PlanSource } from "./plan/planGenerator.ts";
import { executePlan } from "./plan/planExecutor.ts";
import { verifyUntilPass, commandVerifier } from "./plan/planVerifier.ts";
import { createSecureInvoker } from "./plan/secureInvoker.ts";
import type {
  ExecutionMode,
  Plan,
  PlanEvent,
  PlanExecutionResult,
  PlanStep,
  VerificationResult,
} from "./plan/types.ts";
import {
  planToSubtasks,
  runSubtasks,
  DEFAULT_SUBAGENT_CONFIG,
  type SubagentConfig,
  type SubagentRunner,
  type SubagentRunReport,
} from "./subagent/spawner.ts";
import type { IsolatedContext } from "./subagent/isolatedContext.ts";
import { McpRegistry } from "./mcp/mcpRegistry.ts";
import type { McpServerConfig } from "./mcp/mcpClient.ts";

export interface CompactionConfig {
  maxTokens: number;
  keepRecent: number;
  summarizer?: Summarizer;
}

export interface AgentRuntimeOptions {
  /** Absolute path to the project sandbox root. */
  sandboxRoot: string;
  /** The chat model driving the loop. */
  model: ChatModel;
  profile?: SandboxProfileName;
  systemPrompt?: string;
  workspace?: Workspace;
  store?: SessionPersistence;
  auditSink?: AuditSink;
  notifier?: Notifier;
  networkAllowlist?: string[];
  rules?: PermissionRule[];
  /** False when the workspace is virtual (Storage-backed) — see PolicyEngineConfig. */
  followSymlinks?: boolean;
  extraTools?: ToolDefinition[];
  /**
   * Tools to leave out of this runtime.
   *
   * Set when the environment cannot honour one — an Edge Function cannot spawn
   * a process, so `bash` there is a tool that always fails. The model plans
   * around the names it is given, so the name has to go.
   */
  excludeTools?: readonly string[];
  extraHooks?: HookSet;
  confirm?: ConfirmFn;
  autoApproveAsk?: boolean;
  maxSteps?: number;
  compaction?: CompactionConfig;
  now?: () => number;
  idFactory?: () => string;
  onMessage?: (m: ChatMessage) => void;
  // ---- Phase 3 ----
  planSource?: PlanSource;
  subagent?: Partial<SubagentConfig>;
  mcp?: { enabled?: boolean; servers?: McpServerConfig[] };
  verify?: { command?: string; maxAttempts?: number };
  onPlanEvent?: (e: PlanEvent) => void;
}

export interface PlanRunOptions {
  mode?: ExecutionMode;
  sessionId?: string;
  title?: string;
  confirmStep?: (step: PlanStep) => Promise<boolean> | boolean;
  /** Opt in to bounded parallel subagents for file-only independent work. */
  parallel?: boolean;
  verify?: { command?: string; maxAttempts?: number };
}

export interface PlanRunResult {
  sessionId: string;
  plan: Plan;
  execution: PlanExecutionResult;
  verification?: VerificationResult;
  subagent?: SubagentRunReport;
  usage: UsageStats;
}

export interface RunOptions {
  /** Continue an existing session instead of starting a new one. */
  sessionId?: string;
  title?: string;
}

export interface RunResult {
  sessionId: string;
  finalText: string;
  usage: UsageStats;
  stoppedReason: StopReason;
  /**
   * Present when stoppedReason is "awaiting-input": the question to put to the
   * user. The caller shows it and starts the next turn with their answer.
   */
  pendingQuestion?: ClarifyRequest | null;
  session: AgentSession;
}

export interface AgentRuntime {
  run(prompt: string, options?: RunOptions): Promise<RunResult>;
  resumeSession(sessionId: string): Promise<AgentSession>;
  forkSession(sessionId: string, atMessageIndex: number): Promise<AgentSession>;
  getUsage(sessionId?: string): Promise<UsageStats>;
  listSessions(): Promise<AgentSessionSummary[]>;
  exportSession(sessionId: string): Promise<ExportedSession>;
  exportSessionJson(sessionId: string): Promise<string>;
  createCheckpoint(label: string): Promise<Checkpoint>;
  restoreCheckpoint(id: string): Promise<void>;
  /** Generate a structured plan without executing anything. */
  plan(prompt: string): Promise<Plan>;
  /** Generate + (approve) + execute + verify a plan. */
  runPlan(prompt: string, options?: PlanRunOptions): Promise<PlanRunResult>;
  /** Connect approved MCP servers (no-op when the flag is off); returns tool names added. */
  connectMcp(): Promise<string[]>;
  readonly mcpEnabled: boolean;
  /** Direct access to composed layers, for advanced callers. */
  readonly workspace: Workspace;
}

function defaultIdFactory(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `id_${n.toString(36)}_${(n * 2654435761 % 0xffffffff).toString(36)}`;
  };
}

function newSession(profile: string, now: number, id: string, title?: string): AgentSession {
  return {
    id,
    title,
    sandboxProfile: profile,
    status: "active",
    createdAt: now,
    updatedAt: now,
    messages: [],
    usage: emptyUsage(),
  };
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const now = options.now ?? (() => Date.now());
  const idFactory = options.idFactory ?? defaultIdFactory();
  const profileName: SandboxProfileName = options.profile ?? "standard";
  const profile = getProfile(profileName);

  const workspace: Workspace = options.workspace ?? new SandboxFs({ sandboxRoot: options.sandboxRoot });
  const registry = createToolRegistry(options.extraTools ?? [], options.excludeTools ?? []);
  const store = options.store ?? new InMemorySessionStore();
  const auditSink = options.auditSink ?? new InMemoryAuditSink();
  const notifier = options.notifier ?? new InMemoryNotifier();
  const checkpoints = new WorkspaceCheckpointStore(workspace, { now, idFactory });

  const policy = new PolicyEngine({
    profile,
    sandboxRoot: options.sandboxRoot,
    rules: options.rules ?? DEFAULT_RULES,
    networkAllowlist: options.networkAllowlist ?? [],
    followSymlinks: options.followSymlinks,
  });

  const clock = () => now();
  const audit = createAuditHooks(auditSink, clock);
  const realtime = createRealtimeHooks(notifier, clock);
  const hooks = new HookRunner({
    preToolUse: [secretGuardHook, audit.pre, realtime.pre, ...(options.extraHooks?.preToolUse ?? [])],
    postToolUse: [audit.post, realtime.post, ...(options.extraHooks?.postToolUse ?? [])],
  });

  const systemPrompt =
    options.systemPrompt ??
    buildSystemPrompt({ agentLabel: "Issac", toolNames: registry.list().map((t) => t.name) });

  let lastSessionId: string | undefined;

  // ---- Phase 3 composition: plan source, subagents, MCP ----
  const subagentConfig: SubagentConfig = { ...DEFAULT_SUBAGENT_CONFIG, ...(options.subagent ?? {}) };
  const mcpRegistry = new McpRegistry({ enabled: options.mcp?.enabled ?? false });
  for (const s of options.mcp?.servers ?? []) mcpRegistry.addServer(s);
  const planSource: PlanSource =
    options.planSource ?? modelPlanSource(options.model, { now, idFactory, systemPrompt });

  const buildLoopDeps = (control: RuntimeControl): LoopDeps => ({
    model: options.model,
    registry,
    workspace,
    policy,
    hooks,
    systemPrompt,
    root: options.sandboxRoot,
    now,
    idFactory,
    control,
    confirm: options.confirm,
    autoApproveAsk: options.autoApproveAsk,
    maxSteps: options.maxSteps,
    compaction: options.compaction,
    onMessage: options.onMessage,
  });

  // A subagent runs a nested loop wrapped in a checkpoint so a failed branch is
  // recoverable. In production, point each subagent at its own sandbox root for
  // true parallel isolation.
  const subagentRunner = async (opts: { description: string; prompt: string; role?: string }): Promise<string> => {
    const checkpoint = await checkpoints.create(`subagent:${opts.description}`);
    const sub = newSession(profileName, now(), idFactory(), `subagent:${opts.description}`);
    const control = new RuntimeControl({ idFactory });
    try {
      const res = await runAgentLoop(sub, opts.prompt, { ...buildLoopDeps(control), maxSteps: options.maxSteps ?? 6 });
      return res.finalText || `Subagent "${opts.description}" finished.`;
    } catch (e) {
      await checkpoints.restore(checkpoint.id);
      return `Subagent "${opts.description}" failed and was rolled back: ${(e as Error).message}`;
    }
  };

  async function run(prompt: string, runOptions: RunOptions = {}): Promise<RunResult> {
    let session: AgentSession;
    if (runOptions.sessionId) {
      const loaded = await store.load(runOptions.sessionId);
      if (!loaded) throw new Error(`run: session not found: ${runOptions.sessionId}`);
      session = loaded;
      session.status = "active";
    } else {
      session = newSession(profileName, now(), idFactory(), runOptions.title);
    }

    const push = (m: ChatMessage) => {
      options.onMessage?.(m);
      store.save(session).catch((err) => console.error("[Runtime] Auto-save message failed:", err));
    };

    const control = new RuntimeControl({ idFactory, subagentRunner });
    const result = await runAgentLoop(session, prompt, { ...buildLoopDeps(control), onMessage: push });

    // "awaiting-input" is paused, not completed: the agent asked something and
    // the session has to stay resumable so the answer can continue it.
    session.status = result.stoppedReason === "final" ? "completed" : "paused";
    session.updatedAt = now();
    await store.save(session);
    lastSessionId = session.id;

    return {
      sessionId: session.id,
      finalText: result.finalText,
      usage: session.usage,
      stoppedReason: result.stoppedReason,
      pendingQuestion: result.pendingQuestion ?? null,
      session,
    };
  }

  async function resumeSession(sessionId: string): Promise<AgentSession> {
    const s = await resumeSessionOp({ store, now }, sessionId);
    lastSessionId = s.id;
    return s;
  }

  async function forkSession(sessionId: string, atMessageIndex: number): Promise<AgentSession> {
    const forked = await forkSessionOp({ store, now, idFactory }, sessionId, atMessageIndex);
    lastSessionId = forked.id;
    return forked;
  }

  async function getUsage(sessionId?: string): Promise<UsageStats> {
    const id = sessionId ?? lastSessionId;
    if (!id) return emptyUsage();
    const s = await store.load(id);
    return s?.usage ?? emptyUsage();
  }

  async function planOnly(prompt: string): Promise<Plan> {
    return generatePlan(planSource, prompt);
  }

  async function connectMcp(): Promise<string[]> {
    const defs = await mcpRegistry.connectApproved();
    const added: string[] = [];
    for (const d of defs) {
      if (!registry.get(d.name)) {
        registry.register(d);
        added.push(d.name);
      }
    }
    return added;
  }

  // Applies file-only steps to an isolated overlay (used by parallel subagents).
  const overlayRunner: SubagentRunner = async (subtask, ctx: IsolatedContext) => {
    for (const step of subtask.steps) {
      const fp = String(step.input?.file_path ?? subtask.files[0] ?? "");
      if (!fp) continue;
      if (step.type === "file_create") {
        ctx.write(fp, String(step.input?.contents ?? ""));
      } else if (step.type === "file_edit") {
        const cur = ctx.read(fp) ?? "";
        const oldS = String(step.input?.old_string ?? "");
        const newS = String(step.input?.new_string ?? "");
        if (oldS && cur.includes(oldS)) ctx.write(fp, cur.split(oldS).join(newS));
        else if (step.input?.contents !== undefined) ctx.write(fp, String(step.input.contents));
      }
    }
  };

  async function runPlan(prompt: string, po: PlanRunOptions = {}): Promise<PlanRunResult> {
    const mode: ExecutionMode = po.mode ?? "confirm";
    let session: AgentSession;
    if (po.sessionId) {
      const loaded = await store.load(po.sessionId);
      session = loaded ?? newSession(profileName, now(), idFactory(), po.title);
    } else {
      session = newSession(profileName, now(), idFactory(), po.title);
    }
    session.status = "active";

    const control = new RuntimeControl({ idFactory });
    const invoke = createSecureInvoker({
      registry,
      policy,
      hooks,
      workspace,
      control,
      root: options.sandboxRoot,
      sessionId: session.id,
      profileName,
      now,
      idFactory,
      confirm: options.confirm,
      autoApproveAsk: options.autoApproveAsk,
      onToolCall: () => {
        session.usage.toolCalls += 1;
      },
    });

    const thePlan = await generatePlan(planSource, prompt);
    const split = planToSubtasks(thePlan, subagentConfig, idFactory);
    const fileOnly =
      split.mode === "parallel" &&
      split.subtasks.every((st) => st.steps.every((s) => s.type === "file_create" || s.type === "file_edit"));
    const useParallel = (po.parallel ?? false) && fileOnly && mode !== "suggest";

    let execution: PlanExecutionResult;
    let subagent: SubagentRunReport | undefined;

    if (useParallel) {
      subagent = await runSubtasks(split, { workspace, config: subagentConfig, runner: overlayRunner });
      const status = subagent.applied ? "done" : "blocked";
      execution = {
        planId: thePlan.id,
        mode,
        results: thePlan.steps.map((s) => ({ stepId: s.id, status, output: subagent!.reason })),
        executed: subagent.applied ? thePlan.steps.length : 0,
        ok: subagent.applied,
      };
    } else {
      execution = await executePlan(thePlan, {
        invoke,
        mode,
        confirmStep: po.confirmStep,
        onEvent: options.onPlanEvent,
        now,
      });
    }

    let verification: VerificationResult | undefined;
    const verifyCmd = po.verify?.command ?? options.verify?.command;
    if (mode !== "suggest" && verifyCmd) {
      verification = await verifyUntilPass({
        verify: commandVerifier(invoke, verifyCmd),
        maxAttempts: po.verify?.maxAttempts ?? options.verify?.maxAttempts ?? 1,
        onEvent: options.onPlanEvent,
        now,
      });
    }

    session.status = "completed";
    session.updatedAt = now();
    await store.save(session);
    lastSessionId = session.id;

    return { sessionId: session.id, plan: thePlan, execution, verification, subagent, usage: session.usage };
  }

  return {
    run,
    resumeSession,
    forkSession,
    getUsage,
    plan: planOnly,
    runPlan,
    connectMcp,
    mcpEnabled: mcpRegistry.enabled,
    async listSessions() {
      return store.list();
    },
    async exportSession(sessionId: string) {
      const s = await store.load(sessionId);
      if (!s) throw new Error(`exportSession: not found: ${sessionId}`);
      return exportSession(s);
    },
    async exportSessionJson(sessionId: string) {
      const s = await store.load(sessionId);
      if (!s) throw new Error(`exportSession: not found: ${sessionId}`);
      return exportSessionToJson(s);
    },
    async createCheckpoint(label: string) {
      return checkpoints.create(label);
    },
    async restoreCheckpoint(id: string) {
      return checkpoints.restore(id);
    },
    workspace,
  };
}

/* ---- Re-exports so callers import everything from one module ------------- */

export { compactHistory };
export * from "./toolRegistry.ts";
export * from "./systemPrompt.ts";
export * from "./sandbox/profiles.ts";
export * from "./sandbox/pathGuard.ts";
export * from "./permissions/policyEngine.ts";
export * from "./permissions/rules.ts";
export * from "./hooks/hookRunner.ts";
export * from "./hooks/defaultHooks.ts";
export * from "./session/sessionStore.ts";
export * from "./session/compact.ts";
export * from "./session/forkResume.ts";
export * from "./session/exporter.ts";
export * from "./checkpoint.ts";
export * from "./workspace/sandboxFs.ts";
export {
  runAgentLoop,
  RuntimeControl,
  ScriptedModel,
  type ChatModel,
  type ModelResponse,
  type ConfirmFn,
} from "./loop.ts";
export * from "./plan/types.ts";
export * from "./plan/planGenerator.ts";
export * from "./plan/planExecutor.ts";
export * from "./plan/planVerifier.ts";
export * from "./plan/secureInvoker.ts";
export * from "./subagent/spawner.ts";
export * from "./subagent/isolatedContext.ts";
export * from "./subagent/mergeStrategy.ts";
export * from "./mcp/mcpClient.ts";
export * from "./mcp/mcpRegistry.ts";
