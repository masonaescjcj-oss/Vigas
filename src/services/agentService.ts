/**
 * frontend/src/services/agentService.ts
 * ---------------------------------------------------------------------------
 * Talks to the real agent backend:
 *   - actions (run / ask / fork) go through Edge Functions
 *   - reads (sessions / tasks) go through Supabase tables under RLS, or the
 *     local dev gateway's /api/* endpoints when EXPO_PUBLIC_API_URL points at
 *     localhost (guest mode has no real JWT, so RLS reads would return nothing)
 * Errors are surfaced to the caller — no mock fallbacks.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import { API_ORIGIN, IS_LOCAL_API, invokeFunction } from "./functionsClient";

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
      /** "readonly" gives the agent tools that cannot modify the project. */
      profile?: "standard" | "readonly";
    } = {},
  ): Promise<AgentRunAccepted> {
    return invokeFunction<AgentRunAccepted>("agent-run", {
      body: {
        projectId,
        prompt,
        title: options.title,
        sessionId: options.sessionId,
        ...(options.profile ? { profile: options.profile } : {}),
        // "auto" means "server decides" — don't send it.
        ...(options.model && options.model !== "auto" ? { model: options.model } : {}),
      },
    });
  },

  /**
   * Incognito turn: answers and stores nothing — no session, no transcript, no
   * task rows. There is no server-side history, so the caller sends the
   * conversation with each turn and the reply lives only in local state.
   */
  async askIncognito(
    prompt: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    model?: string,
  ): Promise<{ text: string; stored: boolean }> {
    return invokeFunction("agent-ask", {
      body: {
        prompt,
        // The endpoint caps this; trimming here keeps the request small too.
        history: history.slice(-20),
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
