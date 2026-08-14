/**
 * session/sessionStore.ts
 * ---------------------------------------------------------------------------
 * Persistence for agent sessions: the full transcript of a conversation
 * (messages, tool calls, tool results) plus usage and metadata.
 *
 * Two adapters are provided, both real:
 *   - InMemorySessionStore: used by tests and ephemeral runs.
 *   - SupabaseSessionStore: persists to `agent_sessions` (one row per session,
 *     transcript stored as JSONB). It talks to a minimal Supabase-shaped client
 *     so this module does not hard-depend on @supabase/supabase-js.
 * ---------------------------------------------------------------------------
 */

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Present on assistant messages that requested tool execution. */
  toolCalls?: ToolCall[];
  /** Present on tool messages: which tool call this result answers. */
  toolCallId?: string;
  isError?: boolean;
  createdAt: number;
  /** Approximate token count (filled by the runtime / compaction). */
  tokens?: number;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  steps: number;
}

export type SessionStatus = "active" | "paused" | "completed" | "error";

export interface AgentSession {
  id: string;
  title?: string;
  /** Set when this session was forked from another. */
  parentId?: string;
  forkedFromIndex?: number;
  sandboxProfile: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  usage: UsageStats;
}

export interface AgentSessionSummary {
  id: string;
  title?: string;
  status: SessionStatus;
  messageCount: number;
  updatedAt: number;
  parentId?: string;
}

export interface SessionPersistence {
  save(session: AgentSession): Promise<void>;
  load(id: string): Promise<AgentSession | null>;
  list(): Promise<AgentSessionSummary[]>;
  delete(id: string): Promise<void>;
}

export function emptyUsage(): UsageStats {
  return { inputTokens: 0, outputTokens: 0, toolCalls: 0, steps: 0 };
}

export function summarize(session: AgentSession): AgentSessionSummary {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    messageCount: session.messages.length,
    updatedAt: session.updatedAt,
    parentId: session.parentId,
  };
}

/* ---- In-memory adapter --------------------------------------------------- */

export class InMemorySessionStore implements SessionPersistence {
  private readonly sessions = new Map<string, AgentSession>();

  async save(session: AgentSession): Promise<void> {
    // Deep clone so external mutation can't corrupt stored state.
    this.sessions.set(session.id, structuredClone(session));
  }
  async load(id: string): Promise<AgentSession | null> {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }
  async list(): Promise<AgentSessionSummary[]> {
    return [...this.sessions.values()].map(summarize).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

/* ---- Supabase adapter ---------------------------------------------------- */

/** The minimal slice of the supabase-js client surface this store relies on. */
export interface SupabaseLike {
  from(table: string): {
    upsert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    select(cols?: string): {
      eq(col: string, val: unknown): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
      order(col: string, opts: { ascending: boolean }): Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
    };
    delete(): { eq(col: string, val: unknown): Promise<{ error: { message: string } | null }> };
  };
}

export interface SupabaseSessionStoreOptions {
  client: SupabaseLike;
  table?: string;
}

/**
 * Persists each session as one row: { id, title, parent_id, status, profile,
 * usage (jsonb), transcript (jsonb), created_at, updated_at }.
 */
export class SupabaseSessionStore implements SessionPersistence {
  private readonly table: string;
  constructor(private readonly opts: SupabaseSessionStoreOptions) {
    this.table = opts.table ?? "agent_sessions";
  }

  async save(session: AgentSession): Promise<void> {
    const { error } = await this.opts.client.from(this.table).upsert({
      id: session.id,
      title: session.title ?? null,
      parent_id: session.parentId ?? null,
      forked_from_index: session.forkedFromIndex ?? null,
      status: session.status,
      profile: session.sandboxProfile,
      usage: session.usage,
      transcript: session.messages,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
    if (error) throw new Error(`SupabaseSessionStore.save failed: ${error.message}`);
  }

  async load(id: string): Promise<AgentSession | null> {
    const { data, error } = await this.opts.client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`SupabaseSessionStore.load failed: ${error.message}`);
    if (!data) return null;
    return rowToSession(data);
  }

  async list(): Promise<AgentSessionSummary[]> {
    const { data, error } = await this.opts.client
      .from(this.table)
      .select("id,title,status,parent_id,transcript,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`SupabaseSessionStore.list failed: ${error.message}`);
    return (data ?? []).map((row) => summarize(rowToSession(row)));
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.opts.client.from(this.table).delete().eq("id", id);
    if (error) throw new Error(`SupabaseSessionStore.delete failed: ${error.message}`);
  }
}

function rowToSession(row: Record<string, unknown>): AgentSession {
  return {
    id: String(row.id),
    title: (row.title as string | null) ?? undefined,
    parentId: (row.parent_id as string | null) ?? undefined,
    forkedFromIndex: (row.forked_from_index as number | null) ?? undefined,
    sandboxProfile: (row.profile as string) ?? "standard",
    status: (row.status as SessionStatus) ?? "active",
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    messages: (row.transcript as ChatMessage[]) ?? [],
    usage: (row.usage as UsageStats) ?? emptyUsage(),
  };
}
