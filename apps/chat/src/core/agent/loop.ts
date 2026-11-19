/**
 * loop.ts
 * ---------------------------------------------------------------------------
 * The agent execution loop and the per-tool security pipeline.
 *
 * For each model step:
 *   1. (optionally) compact the transcript if it is getting long
 *   2. ask the model for the next turn (text and/or tool calls)
 *   3. for every requested tool call, run the security pipeline:
 *        PreToolUse hooks -> policy engine -> (ask -> confirm) -> execute
 *        -> PostToolUse hooks
 *   4. append results and repeat until the model returns a final text answer
 *
 * The model is an injected interface, so the same loop drives a real LLM in
 * production and a deterministic ScriptedModel in tests.
 *
 * (Phase-1 substrate: the loop skeleton. Phase-2 adds the security pipeline.)
 * ---------------------------------------------------------------------------
 */

import type { AgentControl, ToolRegistry, ToolRisk, Workspace } from "./toolRegistry.ts";
import type { AgentSession, ChatMessage, ToolCall } from "./session/sessionStore.ts";
import type { PermissionDecision, PolicyEngine } from "./permissions/policyEngine.ts";
import type { HookRunner } from "./hooks/hookRunner.ts";
import { compactHistory, type Summarizer } from "./session/compact.ts";
import type { ClarifyRequest } from "./clarify.ts";
import { planToolBatches } from "./toolBatching.ts";

const STRICTNESS: Record<PermissionDecision, number> = { allow: 0, ask: 1, deny: 2 };

/**
 * Why the loop stopped.
 *
 * `awaiting-input` is not a failure and not completion: the agent asked the
 * user something, so the turn is over but the work is not. Callers have to
 * distinguish it — a session that stops this way must stay resumable.
 */
export type StopReason = "final" | "max-steps" | "awaiting-input";

/* ---- Model interface ----------------------------------------------------- */

export interface ModelToolSchema {
  name: string;
  description: string;
  parameters: unknown;
}

export interface ModelResponse {
  text?: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ChatModel {
  generate(params: {
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ModelToolSchema[];
  }): Promise<ModelResponse>;
}

export type ConfirmFn = (req: {
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
}) => Promise<boolean> | boolean;

/* ---- Runtime control (plan mode, todos, subagents) ----------------------- */

export interface RuntimeControlOptions {
  idFactory: () => string;
  onPlanChange?: (planMode: boolean, plan?: string) => void;
  onTodos?: (todos: Array<{ subject: string; status: string }>) => void;
  subagentRunner?: (opts: { description: string; prompt: string; role?: string }) => Promise<string>;
}

export class RuntimeControl implements AgentControl {
  planMode = false;
  todos: Array<{ subject: string; status: string }> = [];
  /**
   * Set when the agent has asked the user something and cannot go further.
   *
   * The loop reads it after each round of tool calls and stops. There is no
   * pause-and-wait inside a run: the turn ends, the question is shown, and the
   * user's answer starts the next turn on the same session. That reuses the
   * transcript the session already keeps, instead of holding a queue worker and
   * a sandbox open for however long someone takes to read three options.
   */
  pendingQuestion: ClarifyRequest | null = null;
  private readonly subagents = new Map<string, { id: string; summary: string }>();

  constructor(private readonly opts: RuntimeControlOptions) {}

  async askUser(request: ClarifyRequest): Promise<void> {
    this.pendingQuestion = request;
  }

  async enterPlanMode(): Promise<void> {
    this.planMode = true;
    this.opts.onPlanChange?.(true);
  }
  async exitPlanMode(plan: string): Promise<void> {
    this.planMode = false;
    this.opts.onPlanChange?.(false, plan);
  }
  async setTodos(todos: Array<{ subject: string; status: string }>): Promise<void> {
    this.todos = todos;
    this.opts.onTodos?.(todos);
  }
  async spawnSubagent(opts: { description: string; prompt: string; role?: string }): Promise<{ id: string; summary: string }> {
    const id = this.opts.idFactory();
    const summary = this.opts.subagentRunner
      ? await this.opts.subagentRunner(opts)
      : `Subagent "${opts.description}" ran with no external runner configured.`;
    const rec = { id, summary };
    this.subagents.set(id, rec);
    return rec;
  }
  async waitForSubagents(ids: string[]): Promise<Array<{ id: string; summary: string }>> {
    return ids.map((id) => this.subagents.get(id) ?? { id, summary: "unknown subagent" });
  }
}

/* ---- Loop ---------------------------------------------------------------- */

export interface LoopDeps {
  model: ChatModel;
  registry: ToolRegistry;
  workspace: Workspace;
  policy: PolicyEngine;
  hooks: HookRunner;
  systemPrompt: string;
  root: string;
  now: () => number;
  idFactory: () => string;
  control?: AgentControl & { planMode: boolean; pendingQuestion?: ClarifyRequest | null };
  confirm?: ConfirmFn;
  /** When true, "ask" decisions auto-approve (trusted/autonomous mode). */
  autoApproveAsk?: boolean;
  maxSteps?: number;
  compaction?: { maxTokens: number; keepRecent: number; summarizer?: Summarizer };
  onMessage?: (m: ChatMessage) => void;
}

export interface LoopRunResult {
  finalText: string;
  session: AgentSession;
  steps: number;
  stoppedReason: StopReason;
  /** Set when stoppedReason is "awaiting-input": what to show the user. */
  pendingQuestion?: ClarifyRequest | null;
}

/** Run the security pipeline for a single tool call and return the tool message. */
async function executeToolCall(
  tc: ToolCall,
  deps: LoopDeps,
  control: AgentControl & { planMode: boolean },
  session: AgentSession,
  // Passed in rather than read off the session: calls in a batch run
  // concurrently, and reading-then-incrementing a shared counter would hand
  // several of them the same index.
  callIndex: number,
): Promise<ChatMessage> {
  const tool = deps.registry.get(tc.name);
  const risk: ToolRisk = tool?.risk ?? "exec";

  const preCtx = {
    sessionId: session.id,
    toolName: tc.name,
    risk,
    input: tc.input,
    sandboxRoot: deps.root,
    profileName: session.sandboxProfile,
    callIndex,
  };

  const hookDecision = await deps.hooks.runPre(preCtx);
  const policyResult = deps.policy.evaluate({ toolName: tc.name, risk, input: tc.input });

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
        ? await deps.confirm({ toolName: tc.name, input: tc.input, reason })
        : false;
    if (approved) {
      decision = "allow";
    } else {
      decision = "deny";
      reason = deps.confirm || deps.autoApproveAsk ? `Declined: ${reason}` : `No confirmation handler; denied by default (${reason})`;
    }
  }

  const start = deps.now();
  let result: { content: string; isError?: boolean };
  let error: string | undefined;

  if (decision === "deny") {
    result = { content: `⛔ Blocked by policy: ${reason}`, isError: true };
  } else {
    try {
      result = await deps.registry.invoke(tc.name, tc.input, {
        workspace: deps.workspace,
        control,
        root: deps.root,
        planMode: control.planMode,
      });
    } catch (e) {
      error = (e as Error).message;
      result = { content: `Tool error: ${error}`, isError: true };
    }
  }

  const durationMs = deps.now() - start;
  await deps.hooks.runPost({ ...preCtx, decision, result, error, durationMs });

  return {
    id: deps.idFactory(),
    role: "tool",
    content: result.content,
    toolCallId: tc.id,
    isError: result.isError,
    createdAt: deps.now(),
  };
}

/** Drive the agent to a final answer, mutating `session` in place. */
export async function runAgentLoop(
  session: AgentSession,
  userPrompt: string,
  deps: LoopDeps,
): Promise<LoopRunResult> {
  const control =
    deps.control ?? new RuntimeControl({ idFactory: deps.idFactory });

  const push = (m: ChatMessage) => {
    session.messages.push(m);
    deps.onMessage?.(m);
  };

  push({ id: deps.idFactory(), role: "user", content: userPrompt, createdAt: deps.now() });

  const maxSteps = deps.maxSteps ?? 12;
  const toolSchemas: ModelToolSchema[] = deps.registry
    .toApiSchema()
    .map((t) => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters }));

  let finalText = "";
  let lastToolTurnText = "";
  let stoppedReason: StopReason = "max-steps";
  let step = 0;

  for (; step < maxSteps; step++) {
    session.usage.steps += 1;

    if (deps.compaction) {
      const res = await compactHistory(session.messages, {
        maxTokens: deps.compaction.maxTokens,
        keepRecent: deps.compaction.keepRecent,
        summarizer: deps.compaction.summarizer,
        now: deps.now,
        idFactory: deps.idFactory,
      });
      if (res.compacted) session.messages = res.messages;
    }

    const resp = await deps.model.generate({
      systemPrompt: deps.systemPrompt,
      messages: session.messages,
      tools: toolSchemas,
    });

    if (resp.usage) {
      session.usage.inputTokens += resp.usage.inputTokens;
      session.usage.outputTokens += resp.usage.outputTokens;
    }

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      // Kept for the stop reasons that are not "final". A model usually says
      // what it is about to do before it does it, and those words are the best
      // thing to show when the turn ends without a closing answer.
      if (resp.text?.trim()) lastToolTurnText = resp.text.trim();
      push({
        id: deps.idFactory(),
        role: "assistant",
        content: resp.text ?? "",
        toolCalls: resp.toolCalls,
        createdAt: deps.now(),
      });
      // Independent calls run together; conflicting ones stay in order. The
      // messages are still pushed in the order the model asked for them —
      // finishing order is an implementation detail, and a transcript that
      // reordered itself by luck would be unreadable and unreplayable.
      let callIndex = session.usage.toolCalls;
      session.usage.toolCalls += resp.toolCalls.length;
      for (const batch of planToolBatches(resp.toolCalls)) {
        const messages = await Promise.all(
          batch.map((tc, i) => executeToolCall(tc, deps, control, session, callIndex + i)),
        );
        callIndex += batch.length;
        for (const toolMsg of messages) push(toolMsg);
      }
      // Asked and cannot continue. Checked after the whole round rather than
      // mid-round so tool calls issued alongside the question still complete
      // and their results are in the transcript when the answer arrives.
      if (control.pendingQuestion) {
        stoppedReason = "awaiting-input";
        step += 1;
        break;
      }
      continue;
    }

    finalText = resp.text ?? "";
    push({ id: deps.idFactory(), role: "assistant", content: finalText, createdAt: deps.now() });
    stoppedReason = "final";
    step += 1;
    break;
  }

  // Running out of steps is not a failure and not completion — it is a build
  // that got partway. Left empty, the caller records a success with no message
  // and a half-finished project is indistinguishable from a finished one, which
  // is what made large requests feel like they silently did not work.
  //
  // The session stays "paused" and agent-run continues an existing session, so
  // saying "continue" genuinely resumes from here.
  if (stoppedReason === "max-steps" && !finalText) {
    finalText =
      `I ran out of steps for this turn — the work so far is saved, but it is not finished. ` +
      `Say **continue** and I will pick up where I stopped.`;
  }

  // Same failure, different cause: a turn that ends on a question also never
  // reaches the final-answer branch, so it too came back with nothing to show.
  // The question is rendered as its own card, but an empty message above it
  // reads as the agent having said nothing at all.
  if (stoppedReason === "awaiting-input" && !finalText) {
    finalText = lastToolTurnText || "Before I build this, one thing I would rather not guess at:";
  }

  session.updatedAt = deps.now();
  return { finalText, session, steps: step, stoppedReason, pendingQuestion: control.pendingQuestion };
}

/* ---- Deterministic model for tests & the README demo --------------------- */

/**
 * A scripted model that replays a fixed list of turns, then returns a final
 * message. Real deployments implement {@link ChatModel} over an LLM API.
 */
export class ScriptedModel implements ChatModel {
  private i = 0;
  constructor(
    private readonly turns: ModelResponse[],
    private readonly fallbackText = "Done.",
  ) {}
  async generate(): Promise<ModelResponse> {
    if (this.i < this.turns.length) return this.turns[this.i++];
    return { text: this.fallbackText, usage: { inputTokens: 1, outputTokens: 1 } };
  }
}
