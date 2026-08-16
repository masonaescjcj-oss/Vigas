/**
 * frontend/src/services/agentService.ts
 * ---------------------------------------------------------------------------
 * Talks to the real agent backend:
 *   - actions (run / ask / fork) go through Edge Functions
 *   - Build runs the agent through the job queue; Chat and Incognito answer
 *     directly via agent-ask, with no queue, worker or sandbox involved
 *   - reads (sessions / tasks) go through Supabase tables under RLS, or the
 *     local dev gateway's /api/* endpoints when EXPO_PUBLIC_API_URL points at
 *     localhost (guest mode has no real JWT, so RLS reads would return nothing)
 * Errors are surfaced to the caller — no mock fallbacks.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import { API_ORIGIN, IS_LOCAL_API, invokeFunction } from "./functionsClient";

/**
 * How many past turns a question carries. Mirrors ASK_HISTORY_TURNS in the
 * edge function's schema — the server enforces it, this just avoids sending
 * more than will be used.
 */
export const ASK_HISTORY_TURNS = 20;

export interface AgentSessionData {
  id: string;
  project_id: string;
  title?: string | null;
  status: "active" | "completed" | "failed" | "archived" | "paused";
  model_provider: string;
  token_usage_total: number;
  transcript: any[]; // Chat history messages
  created_at: string;
  updated_at: string;
}

export interface AgentTaskData {
  id: string;
  session_id: string;
  tool_name: string;
  tool_input?: any;
  tool_output?: any;
  status: "pending" | "running" | "success" | "failed";
  duration_ms?: number;
  created_at: string;
}

export interface AgentRunAccepted {
  accepted: boolean;
  session_id: string;
  job_id: string;
  status?: string;
  created_at?: string;
}

async function localApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const agentService = {
  /** Create/continue a session & trigger agent-run. Returns immediately (HTTP 202). */
  async startAgentRun(
    projectId: string,
    prompt: string,
    options: {
      title?: string;
      sessionId?: string;
      model?: string;
    } = {},
  ): Promise<AgentRunAccepted> {
    return invokeFunction<AgentRunAccepted>("agent-run", {
      body: {
        projectId,
        prompt,
        title: options.title,
        sessionId: options.sessionId,
        // "auto" means "server decides" — don't send it.
        ...(options.model && options.model !== "auto" ? { model: options.model } : {}),
      },
    });
  },

  /**
   * Ask a question. The answer comes back in the response — no job queue, no
   * worker, no sandbox — because talking to a model needs none of them.
   *
   * With a projectId the chat is stored and the server carries the history, so
   * a follow-up only sends the new message. Without one it is incognito:
   * nothing is stored, so the caller sends the conversation each turn and the
   * reply lives only in local state.
   */
  async ask(options: {
    prompt: string;
    projectId?: string;
    sessionId?: string;
    title?: string;
    /** Incognito only — a stored chat rejects this, it has its own. */
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    model?: string;
  }): Promise<{
    text: string;
    /** Up to 3 likely next questions, generated with the answer. */
    follow_ups: string[];
    stored: boolean;
    session_id: string | null;
    context_turns: number;
  }> {
    const { prompt, projectId, sessionId, title, history, model } = options;
    return invokeFunction("agent-ask", {
      body: {
        prompt,
        ...(projectId ? { projectId } : {}),
        ...(sessionId ? { sessionId } : {}),
        ...(title ? { title } : {}),
        // The endpoint caps this; trimming here keeps the request small too.
        ...(projectId ? {} : { history: (history ?? []).slice(-ASK_HISTORY_TURNS) }),
        ...(model && model !== "auto" ? { model } : {}),
      },
    });
  },

  /** Fork a session from a specific message index. */
  async forkAgentSession(sessionId: string, atMessageIndex: number): Promise<AgentSessionData> {
    return invokeFunction<AgentSessionData>("agent-fork", {
      body: { sessionId, atMessageIndex },
    });
  },

  /**
   * Chats whose title matches, newest first. Titles are the first prompt of a
   * conversation, so this finds "the chat where I asked about X" without
   * needing a full-text index over transcripts.
   */
  async searchSessionsByTitle(term: string, limit = 10): Promise<AgentSessionData[]> {
    // % and _ are wildcards in LIKE; a user typing them means the characters.
    const escaped = term.replace(/[%_\\]/g, (char) => `\\${char}`);
    const { data, error } = await supabase
      .from("agent_sessions")
      .select("*")
      .ilike("title", `%${escaped}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as AgentSessionData[];
  },

  /** Get details of a single agent session (including message transcript). */
  async getSession(sessionId: string): Promise<AgentSessionData> {
    if (IS_LOCAL_API) return localApiGet<AgentSessionData>(`/api/sessions/${sessionId}`);
    const { data, error } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (error) throw new Error(error.message);
    return data as AgentSessionData;
  },

  /** Get all sessions for a specific project. */
  async getProjectSessions(projectId: string): Promise<AgentSessionData[]> {
    if (IS_LOCAL_API) {
      return localApiGet<AgentSessionData[]>(`/api/project-sessions/${projectId}`);
    }
    const { data, error } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AgentSessionData[];
  },

  /** Get all task/tool execution steps logged for a session. */
  async getSessionTasks(sessionId: string): Promise<AgentTaskData[]> {
    if (IS_LOCAL_API) {
      return localApiGet<AgentTaskData[]>(`/api/sessions/${sessionId}/tasks`);
    }
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as AgentTaskData[];
  },
};
