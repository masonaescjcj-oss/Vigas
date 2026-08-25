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
import type { AuditEntry } from "../../../src/core/agent/hooks/defaultHooks.ts";
import { AppError, asAppError } from "./errorHandler.ts";
import { skillPromptFor } from "../../../src/core/agent/skills/catalog.ts";
import { backendContextFor } from "../../../src/core/agent/backendContext.ts";
import { buildSystemPrompt } from "../../../src/core/agent/systemPrompt.ts";
import { PROJECT_FILES_BUCKET, StorageWorkspace } from "./storage.ts";
import { SandboxManager } from "../../../src/infra/sandbox/sandboxManager.ts";
import { LocalSandboxProvider } from "./localProvider.ts";
import { SystemdSandboxProvider, systemdSandboxAvailable } from "./systemdProvider.ts";

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
  async record(entry: AuditEntry): Promise<void> {
    const key = `${entry.sessionId}:${entry.callIndex}`;
    if (entry.phase === "start") {
      const { data, error } = await this.client.from("agent_tasks").insert({ session_id: entry.sessionId, tool_name: entry.toolName, tool_input: { call_index: entry.callIndex, target: entry.target ?? null, detail: entry.detail ?? null }, status: "running" }).select("id").single();
      if (error || !data) throw error ?? new Error("agent_tasks insert returned no row");
      this.ids.set(key, String(data.id));
      return;
    }
    const id = this.ids.get(key);
    if (!id) return;
    const { error } = await this.client.from("agent_tasks").update({
      status: entry.ok ? "success" : "failed",
      duration_ms: entry.durationMs ?? null,
      // detail carries the plan text and the checklist, which are the two
      // steps a user actually reads. Everything else is described by target.
      tool_input: { call_index: entry.callIndex, target: entry.target ?? null, detail: entry.detail ?? null },
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
 * Fallback allow-list, used only when the catalogue cannot be read.
 *
 * The `models` table is the real allow-list — its own migration says it
 * "replaces a hardcoded list in the app and an ALLOWED_MODELS environment
 * variable", and this is what is left of that variable. It stays as a floor so
 * that a database hiccup degrades to "the usual models work" instead of
 * "nobody can pick anything".
 */
export const FALLBACK_MODELS: readonly string[] = (
  Deno.env.get("ALLOWED_MODELS") ?? "gpt-5.6-luna,deepseek-v4-flash,deepseek-chat,deepseek-reasoner"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Rank of a plan key. Higher includes everything lower.
 *
 * @param whenUnknown What an unrecognised key ranks as. Asymmetric on purpose,
 *   because both directions have to fail closed: the tier a user *holds* ranks
 *   lowest when unknown (a typo in a profile row must not hand out paid models),
 *   while the tier a model *demands* ranks highest (a model gated on a deleted
 *   plan would otherwise tie with free and be given away).
 */
async function planRank(
  service: SupabaseClient,
  key: string,
  whenUnknown: number,
): Promise<number> {
  const { data } = await service.from("plans").select("sort_order").eq("key", key).maybeSingle();
  return data?.sort_order === undefined || data?.sort_order === null
    ? whenUnknown
    : Number(data.sort_order);
}

/**
 * Decide which model id a run may use.
 *
 * This is where "the admin marks a model premium" becomes true. Until now the
 * decision lived in an environment variable that knew nothing about the
 * catalogue, so `min_tier` was stored, editable in the admin panel, and
 * enforced nowhere — a free account could request the premium model by name and
 * be served it.
 *
 * Two failure modes, deliberately different:
 *
 *   - **Not allowed for this tier** throws. The picker should have prevented it,
 *     so arriving here means a stale client or a direct API call. Silently
 *     substituting the default would bill someone for a model they did not pick
 *     and never tell them, which is worse than an error naming the upgrade.
 *   - **Unknown, or switched off** falls back to the server default. `is_active`
 *     false is how an operator takes a broken model out of service, and the
 *     kinder response to that is a working model, not a dead end.
 */
export async function resolveRequestedModel(
  service: SupabaseClient,
  requested: string | null | undefined,
  tier: string,
): Promise<string | undefined> {
  if (!requested || requested === "auto") return undefined;

  const { data: model, error } = await service
    .from("models")
    .select("id,is_active,min_tier")
    .eq("id", requested)
    .maybeSingle();

  // Catalogue unreadable (not yet migrated, or a transient failure): fall back
  // to the floor rather than refusing every run.
  if (error) {
    console.error(`[models] catalogue unreadable, using fallback list: ${error.message}`);
    return FALLBACK_MODELS.includes(requested) ? requested : undefined;
  }

  if (!model || model.is_active === false) return undefined;
  if (!model.min_tier) return requested;

  const [required, held] = await Promise.all([
    planRank(service, String(model.min_tier), Number.POSITIVE_INFINITY),
    planRank(service, tier, 0),
  ]);
  if (held >= required) return requested;

  throw new AppError(
    403,
    "MODEL_REQUIRES_UPGRADE",
    `That model is available on ${model.min_tier} and above.`,
    { model: model.id, requiredTier: model.min_tier, currentTier: tier },
  );
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
  /** The user's Supabase project, when they have connected one. */
  backend?: { url: string; anonKey: string } | null;
}

/** Builds the sandbox manager with the same provider selection the runtime uses
 * (E2B when configured, local temp-dir provider otherwise). Exposed so the
 * queue worker can destroy the session sandbox as soon as a job finishes. */
/**
 * Pick the strongest sandbox this host can offer.
 *
 *   E2B          a rented VM; nothing of ours is at risk.
 *   systemd-run  a capped, unprivileged scope on our own machine. Chosen on a
 *                Linux server, where an uncapped build would compete with
 *                whatever else runs there.
 *   local        a plain subprocess. Right on a developer's laptop, and the
 *                only option on one.
 */
export function createEdgeSandboxManager(client: SupabaseClient): SandboxManager {
  if (Deno.env.get("E2B_API_KEY")) return new SandboxManager(client, undefined);
  const provider = systemdSandboxAvailable()
    ? new SystemdSandboxProvider()
    : new LocalSandboxProvider();
  return new SandboxManager(client, provider);
}

/**
 * Whether this process can actually run a command.
 *
 * Two things have to be true, and only one of them is a setting:
 *
 *   - With E2B_API_KEY the command runs in a rented VM, which always works.
 *   - Without it the fallback is LocalSandboxProvider, which spawns a real
 *     process — fine on a developer's machine, impossible inside an Edge
 *     Function. Supabase blocklists Deno.makeTempDirSync and Deno.Command
 *     there, so the very first call fails with a runtime error rather than a
 *     tidy "not supported".
 *
 * Detected rather than assumed: the same worker code runs both places, and a
 * constant would be wrong in one of them. `makeTempDirSync` is what the local
 * provider reaches for first, so probing it asks exactly the question that
 * matters.
 */
export function canRunCommands(): boolean {
  if (Deno.env.get("E2B_API_KEY")) return true;
  try {
    const probe = Deno.makeTempDirSync({ prefix: "issac-probe-" });
    Deno.removeSync(probe, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function createEdgeAgentRuntime(options: RuntimeFactoryOptions): AgentRuntime {
  const prefix = options.sandboxPath ?? `users/${options.user.id}/projects/${options.projectId}`;
  const sandboxManager = options.sandboxManager ?? createEdgeSandboxManager(options.client);
  const workspace = new StorageWorkspace({ client: options.client, bucket: PROJECT_FILES_BUCKET, prefix, projectId: options.projectId, userId: options.user.id, sessionId: options.sessionId, sandboxManager });
  // Appended, not replaced: the base prompt is what makes the tools work at all,
  // and a skill is guidance layered on top of it.
  const extra = [
    skillPromptFor(options.skills),
    // Last, so it is the closest thing to the request — and it ends on the Row
    // Level Security instruction, which is what decides whether the built app is
    // safe or wide open.
    backendContextFor(options.backend ?? null),
  ].filter(Boolean).join("\n");
  const systemPrompt = extra ? `${buildSystemPrompt()}\n${extra}` : undefined;

  return createAgentRuntime({
    sandboxRoot: workspace.root,
    // A tool that cannot work is worse than one that is missing: offered
    // `bash`, the model plans a typecheck or an install, calls it, gets an
    // error it cannot act on, and continues with a plan whose middle step
    // never happened. Withholding the name is the only honest signal.
    excludeTools: canRunCommands() ? [] : ["bash"],
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
