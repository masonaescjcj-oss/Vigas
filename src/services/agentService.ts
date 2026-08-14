/**
 * frontend/src/services/agentService.ts
 * ---------------------------------------------------------------------------
 * Talks to the real agent backend:
 *   - actions (run / resume / fork) go through Edge Functions
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
    options: { title?: string; sessionId?: string } = {},
  ): Promise<AgentRunAccepted> {
    return invokeFunction<AgentRunAccepted>("agent-run", {
      body: {
        projectId,
        prompt,
        title: options.title,
        sessionId: options.sessionId,
      },
    });
  },

  /** Resume a paused session with a new prompt. */
  async resumeAgentRun(
    sessionId: string,
    prompt: string,
  ): Promise<{ accepted: boolean; job_id: string }> {
    return invokeFunction("agent-resume", { body: { sessionId, prompt } });
  },

  /** Fork a session from a specific message index. */
  async forkAgentSession(sessionId: string, atMessageIndex: number): Promise<AgentSessionData> {
    return invokeFunction<AgentSessionData>("agent-fork", {
      body: { sessionId, atMessageIndex },
    });
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
