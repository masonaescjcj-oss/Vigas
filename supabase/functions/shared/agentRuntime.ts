import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createAgentRuntime,
  emptyUsage,
  type AgentRuntime,
  type AgentSession,
  type AgentSessionSummary,
  type ChatMessage,
  type ChatModel,
  type SessionPersistence,
  type UsageStats,
} from "../../../src/core/agent/index.ts";
import { AppError, asAppError } from "./errorHandler.ts";
import { skillPromptFor } from "../../../src/core/agent/skills/catalog.ts";
import { buildSystemPrompt } from "../../../src/core/agent/systemPrompt.ts";
import { PROJECT_FILES_BUCKET, StorageWorkspace } from "./storage.ts";
import { SandboxManager } from "../../../src/infra/sandbox/sandboxManager.ts";
import { LocalSandboxProvider } from "./localProvider.ts";

type SessionRow = Record<string, unknown>;

function iso(milliseconds: number): string {
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function usageFrom(row: unknown): UsageStats {
  const value = (row && typeof row === "object" ? row : {}) as Partial<UsageStats>;
  return {
    inputTokens: Number(value.inputTokens ?? 0),
    outputTokens: Number(value.outputTokens ?? 0),
    toolCalls: Number(value.toolCalls ?? 0),
    steps: Number(value.steps ?? 0),
  };
}

function rowToSession(row: SessionRow): AgentSession {
  return {
    id: String(row.id),
    title: (row.title as string | null) ?? undefined,
    parentId: (row.parent_id as string | null) ?? undefined,
    forkedFromIndex: row.forked_from_index == null ? undefined : Number(row.forked_from_index),
    sandboxProfile: String(row.profile ?? "standard"),
    status: (row.status as AgentSession["status"]) ?? "active",
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
    messages: (row.transcript as ChatMessage[]) ?? [],
    usage: usageFrom(row.usage),
  };
}

export class EdgeSessionStore implements SessionPersistence {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly projectId: string,
  ) {}

  async save(session: AgentSession): Promise<void> {
    const { error } = await this.client.from("agent_sessions").upsert({
      id: session.id,
      project_id: this.projectId,
      user_id: this.userId,
      title: session.title ?? null,
      parent_id: session.parentId ?? null,
      forked_from_index: session.forkedFromIndex ?? null,
      status: session.status,
      profile: session.sandboxProfile,
      usage: session.usage,
      transcript: session.messages,
      token_usage_total: session.usage.inputTokens + session.usage.outputTokens,
      created_at: iso(session.createdAt),
      updated_at: iso(session.updatedAt),
    }, { onConflict: "id" });
    if (error) asAppError(error, "Saving agent session");
  }

  async load(id: string): Promise<AgentSession | null> {
    const { data, error } = await this.client.from("agent_sessions").select("*").eq("id", id).eq("user_id", this.userId).eq("project_id", this.projectId).maybeSingle();
    if (error) asAppError(error, "Loading agent session");
    return data ? rowToSession(data) : null;
  }

  async list(): Promise<AgentSessionSummary[]> {
    const { data, error } = await this.client.from("agent_sessions").select("id,title,status,parent_id,transcript,updated_at").eq("user_id", this.userId).eq("project_id", this.projectId).order("updated_at", { ascending: false });
    if (error) asAppError(error, "Listing agent sessions");
    return (data ?? []).map((row) => {
      const session = rowToSession(row);
      return { id: session.id, title: session.title, status: session.status, messageCount: session.messages.length, updatedAt: session.updatedAt, parentId: session.parentId };
    });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("agent_sessions").delete().eq("id", id).eq("user_id", this.userId).eq("project_id", this.projectId);
    if (error) asAppError(error, "Deleting agent session");
  }
}

export class SupabaseAuditSink {
  private readonly ids = new Map<string, string>();
  constructor(private readonly client: SupabaseClient) {}
  async record(entry: { sessionId: string; toolName: string; phase: "start" | "end"; callIndex: number; decision?: string; ok?: boolean; error?: string; durationMs?: number; at: number; target?: string; metrics?: Record<string, number> }): Promise<void> {
    const key = `${entry.sessionId}:${entry.callIndex}`;
    if (entry.phase === "start") {
      const { data, error } = await this.client.from("agent_tasks").insert({ session_id: entry.sessionId, tool_name: entry.toolName, tool_input: { call_index: entry.callIndex, target: entry.target ?? null }, status: "running" }).select("id").single();
      if (error || !data) throw error ?? new Error("agent_tasks insert returned no row");
      this.ids.set(key, String(data.id));
      return;
    }
    const id = this.ids.get(key);
    if (!id) return;
    const { error } = await this.client.from("agent_tasks").update({
      status: entry.ok ? "success" : "failed",
      duration_ms: entry.durationMs ?? null,
      tool_input: { call_index: entry.callIndex, target: entry.target ?? null },
      tool_output: entry.error
        ? { error: entry.error, decision: entry.decision ?? "allow" }
        : { decision: entry.decision ?? "allow", metrics: entry.metrics ?? null },
    }).eq("id", id);
    if (error) throw error;
  }
}

function apiMessages(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: unknown }> {
  const converted: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const message of messages) {
    if (message.role === "system") {
      converted.push({ role: "user", content: `[Runtime context]\n${message.content}` });
    } else if (message.role === "user") {
      converted.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      const blocks: unknown[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const tool of message.toolCalls ?? []) blocks.push({ type: "tool_use", id: tool.id, name: tool.name, input: tool.input });
      converted.push({ role: "assistant", content: blocks.length === 1 && (blocks[0] as { type?: string }).type === "text" ? message.content : blocks });
    } else if (message.role === "tool") {
      converted.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId ?? message.id, content: message.content, is_error: message.isError === true }] });
    }
  }
  const normalized: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const item of converted) {
    const last = normalized.at(-1);
    if (last?.role === item.role) {
      const left = Array.isArray(last.content) ? last.content : [{ type: "text", text: String(last.content) }];
      const right = Array.isArray(item.content) ? item.content : [{ type: "text", text: String(item.content) }];
      last.content = [...left, ...right];
    } else normalized.push(item);
  }
  if (!normalized.length || normalized[0].role !== "user") normalized.unshift({ role: "user", content: "Continue the task." });
  return normalized;
}

export class AnthropicChatModel implements ChatModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  constructor(modelOverride?: string) {
    this.apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    this.model = modelOverride ?? Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5";
    this.maxTokens = Number(Deno.env.get("ANTHROPIC_MAX_TOKENS") ?? 8_192);
    if (!this.apiKey) throw new AppError(500, "SERVER_MISCONFIGURED", "ANTHROPIC_API_KEY is not configured.");
    if (!Number.isInteger(this.maxTokens) || this.maxTokens < 256 || this.maxTokens > 64_000) throw new AppError(500, "SERVER_MISCONFIGURED", "ANTHROPIC_MAX_TOKENS must be between 256 and 64000.");
  }
  async generate(params: { systemPrompt: string; messages: ChatMessage[]; tools: Array<{ name: string; description: string; parameters: unknown }> }): Promise<{ text?: string; toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>; usage?: { inputTokens: number; outputTokens: number } }> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: this.model, max_tokens: this.maxTokens, system: params.systemPrompt, messages: apiMessages(params.messages), tools: params.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) }),
    });
    const body = await response.json().catch(() => null) as { content?: Array<Record<string, unknown>>; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } } | null;
    if (!response.ok || !body) throw new AppError(502, "MODEL_UNAVAILABLE", body?.error?.message ?? "The agent model request failed.");
    const text = (body.content ?? []).filter((block) => block.type === "text").map((block) => String(block.text ?? "")).join("");
    const toolCalls = (body.content ?? []).filter((block) => block.type === "tool_use").map((block) => ({ id: String(block.id), name: String(block.name), input: (block.input as Record<string, unknown>) ?? {} }));
    return { text: text || undefined, toolCalls: toolCalls.length ? toolCalls : undefined, usage: { inputTokens: Number(body.usage?.input_tokens ?? 0), outputTokens: Number(body.usage?.output_tokens ?? 0) } };
  }
}

/**
 * Models a client may request per run. Anything else falls back to the server
 * default — a client must never be able to point the agent at an arbitrary
 * model string (cost and availability are server concerns).
 */
export const ALLOWED_MODELS: readonly string[] = (
  Deno.env.get("ALLOWED_MODELS") ?? "gpt-5.6-luna,deepseek-v4-flash,deepseek-chat,deepseek-reasoner"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

export function resolveRequestedModel(requested?: string | null): string | undefined {
  if (!requested || requested === "auto") return undefined;
  return ALLOWED_MODELS.includes(requested) ? requested : undefined;
}

/**
 * Read the arguments of a tool call.
 *
 * The provider sends these as a JSON *string* — measured, not assumed. Two things
 * can go wrong with that, and the old code answered both by substituting `{}`:
 *
 *   - The JSON is truncated, which happens when a model runs out of room
 *     mid-argument. A long `content` for `write` is exactly where that lands.
 *   - A different provider hands back an object instead of a string.
 *
 * Calling a tool with `{}` is the worst available response. `write` with no path,
 * `edit` with no content, `bash` with no command — each then fails for a reason
 * that looks like the tool's fault or the model's, when in fact we dropped what
 * the model said. Failing here names the real cause.
 */
export function parseToolArguments(name: unknown, raw: unknown): Record<string, unknown> {
  // Some providers skip the string encoding entirely.
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;

  // No arguments at all is legitimate for a tool that takes none.
  if (raw === undefined || raw === null || raw === "") return {};

  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("arguments were not a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError(
      502,
      "MODEL_TOOL_ARGUMENTS_UNREADABLE",
      `The model's arguments for "${String(name ?? "a tool")}" arrived incomplete, ` +
        "so the step was not run. This usually means the answer was cut off — try again, " +
        "or ask for a smaller change.",
      { arguments: String(raw).slice(0, 200) },
    );
  }
}

export class OpenAIChatModel implements ChatModel {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  /**
   * @param modelOverride A model id, allow-listed by the caller.
   * @param credentials   A user's own provider. When present it replaces the
   *                      server's entirely — key, endpoint and default model —
   *                      because those three only make sense together.
   */
  constructor(
    modelOverride?: string,
    credentials?: { apiKey?: string; baseUrl?: string; model?: string },
  ) {
    this.apiKey = credentials?.apiKey
      || Deno.env.get("OPENAI_API_KEY")
      || Deno.env.get("AI_API_KEY")
      || "";
    this.model = modelOverride
      ?? credentials?.model
      ?? Deno.env.get("OPENAI_MODEL")
      ?? "gpt-4o";
    this.baseUrl = credentials?.baseUrl
      ?? Deno.env.get("OPENAI_BASE_URL")
      ?? "https://api.openai.com/v1";
    if (!this.apiKey) throw new AppError(500, "SERVER_MISCONFIGURED", "OPENAI_API_KEY is not configured.");
  }

  async generate(params: {
    systemPrompt: string;
    messages: ChatMessage[];
    tools: Array<{ name: string; description: string; parameters: unknown }>;
  }): Promise<{
    text?: string;
    toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    const formattedMessages = [
      { role: "system", content: params.systemPrompt },
      ...params.messages.map((msg) => {
        if (msg.role === "assistant") {
          return {
            role: "assistant" as const,
            content: msg.content || null,
            tool_calls: msg.toolCalls?.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input),
              },
            })),
          };
        } else if (msg.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: msg.toolCallId ?? msg.id,
            content: msg.content || "",
          };
        } else {
          return {
            role: msg.role === "system" ? ("system" as const) : ("user" as const),
            content: msg.content || "",
          };
        }
      }),
    ];

    const formattedTools = params.tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
      temperature: 0.2,
    };

    if (formattedTools.length > 0) {
      body.tools = formattedTools;
    }

    // A refused connection, a DNS failure or a dropped TLS session throws here
    // rather than returning a response. Left alone it becomes a bare 500 —
    // "an unexpected server error occurred" — which tells the user neither what
    // broke nor that trying again is worth it.
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AppError(
        502,
        "MODEL_UNREACHABLE",
        "Could not reach the model provider. This is usually temporary — try again.",
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new AppError(
        502,
        "MODEL_UNAVAILABLE",
        data?.error?.message ?? `OpenAI request failed with status ${response.status}`
      );
    }

    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    const openAiToolCalls = choice?.message?.tool_calls;

    const toolCalls = openAiToolCalls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name,
      input: parseToolArguments(tc.function?.name, tc.function?.arguments),
    }));

    return {
      text: text || undefined,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: {
        inputTokens: Number(data.usage?.prompt_tokens ?? 0),
        outputTokens: Number(data.usage?.completion_tokens ?? 0),
      },
    };
  }
}

export interface RuntimeFactoryOptions {
  client: SupabaseClient;
  user: User;
  projectId: string;
  sandboxPath?: string;
  profile?: "standard" | "readonly";
  onMessage?: (message: ChatMessage) => void;
  sessionId?: string;
  sandboxManager?: SandboxManager;
  /** Allow-listed model id for this run; falls back to the server default. */
  model?: string;
  /**
   * The user's own provider, already decrypted. Passed in rather than looked
   * up here so the key exists only for the life of the run and never reaches
   * a job payload or a session row.
   */
  credentials?: { apiKey?: string; baseUrl?: string; model?: string };
  /**
   * Skill ids the user switched on. Resolved against the catalog here, so an id a
   * client invented contributes nothing rather than becoming system-prompt text of
   * its own.
   */
  skills?: readonly string[];
}

/** Builds the sandbox manager with the same provider selection the runtime uses
 * (E2B when configured, local temp-dir provider otherwise). Exposed so the
 * queue worker can destroy the session sandbox as soon as a job finishes. */
export function createEdgeSandboxManager(client: SupabaseClient): SandboxManager {
  const sandboxProvider = Deno.env.get("E2B_API_KEY") ? undefined : new LocalSandboxProvider();
  return new SandboxManager(client, sandboxProvider);
}

export function createEdgeAgentRuntime(options: RuntimeFactoryOptions): AgentRuntime {
  const prefix = options.sandboxPath ?? `users/${options.user.id}/projects/${options.projectId}`;
  const sandboxManager = options.sandboxManager ?? createEdgeSandboxManager(options.client);
  const workspace = new StorageWorkspace({ client: options.client, bucket: PROJECT_FILES_BUCKET, prefix, projectId: options.projectId, userId: options.user.id, sessionId: options.sessionId, sandboxManager });
  // Appended, not replaced: the base prompt is what makes the tools work at all,
  // and a skill is guidance layered on top of it.
  const extra = skillPromptFor(options.skills);
  const systemPrompt = extra ? `${buildSystemPrompt()}
${extra}` : undefined;

  return createAgentRuntime({
    sandboxRoot: workspace.root,
    ...(systemPrompt ? { systemPrompt } : {}),
    workspace,
    store: new EdgeSessionStore(options.client, options.user.id, options.projectId),
    // A user's own provider is OpenAI-compatible by definition, so it always
    // takes the OpenAI path regardless of what the server is configured with.
    model: options.credentials?.apiKey
      || Deno.env.get("OPENAI_API_KEY")
      || Deno.env.get("AI_API_KEY")
      || !Deno.env.get("ANTHROPIC_API_KEY")
      ? new OpenAIChatModel(options.model, options.credentials)
      : new AnthropicChatModel(options.model),
    profile: options.profile ?? "standard",
    // The workspace lives in Storage, not on this host's filesystem, so
    // resolving sandbox paths against the real FS would falsely deny valid
    // targets (e.g. list_dir "."). Textual containment still applies.
    followSymlinks: false,
    autoApproveAsk: true,
    maxSteps: Number(Deno.env.get("AGENT_MAX_STEPS") ?? 12),
    compaction: {
      maxTokens: Number(Deno.env.get("AGENT_COMPACT_MAX_TOKENS") ?? 48_000),
      keepRecent: Number(Deno.env.get("AGENT_COMPACT_KEEP_RECENT") ?? 8),
    },
    idFactory: () => crypto.randomUUID(),
    onMessage: options.onMessage,
    auditSink: new SupabaseAuditSink(options.client),
  });
}

export async function ensureSession(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  sessionId: string,
  profile: "standard" | "readonly",
  title?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await client.from("agent_sessions").select("id").eq("id", sessionId).eq("user_id", userId).eq("project_id", projectId).maybeSingle();
  if (lookupError) asAppError(lookupError, "Loading agent session");
  if (existing) return;
  const { error } = await client.from("agent_sessions").insert({ id: sessionId, project_id: projectId, user_id: userId, status: "active", model_provider: "claude", profile, title: title ?? null, usage: emptyUsage(), transcript: [], created_at: now, updated_at: now });
  if (error) asAppError(error, "Creating agent session");
}

export async function assertProjectOwner(client: SupabaseClient, userId: string, projectId: string): Promise<{ id: string; sandbox_path: string }> {
  const { data, error } = await client.from("projects").select("id,sandbox_path").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (error) asAppError(error, "Loading project");
  if (!data) throw new AppError(404, "PROJECT_NOT_FOUND", "Project was not found.");
  const expected = `users/${userId}/projects/${projectId}`;
  const storedPath = String(data.sandbox_path ?? "").replace(/^\/+|\/+$/g, "");
  if (storedPath !== expected && !storedPath.startsWith(`${expected}/`)) {
    throw new AppError(409, "INVALID_PROJECT_SANDBOX", "The project sandbox path is invalid; recreate the project before running an agent.");
  }
  return data;
}
