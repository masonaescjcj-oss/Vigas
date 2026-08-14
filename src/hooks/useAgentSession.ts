/**
 * frontend/src/hooks/useAgentSession.ts
 * ---------------------------------------------------------------------------
 * TanStack Query hook managing chat history (transcript), task/tool execution
 * list, agent run mutations, and real-time Supabase subscriptions.
 * ---------------------------------------------------------------------------
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { agentService, type AgentSessionData, type AgentTaskData } from "../services/agentService";

export const useAgentSession = (sessionId?: string) => {
  const queryClient = useQueryClient();

  // Query: Get session details (transcript messages)
  const sessionQuery = useQuery({
    queryKey: ["session-details", sessionId],
    queryFn: () => agentService.getSession(sessionId!),
    enabled: !!sessionId,
  });

  // Query: Get session logged tasks/tools
  const tasksQuery = useQuery({
    queryKey: ["session-tasks", sessionId],
    queryFn: () => agentService.getSessionTasks(sessionId!),
    enabled: !!sessionId,
  });

  // Real-time subscription to agent_tasks table to live-update execution steps
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`tasks-realtime:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_tasks",
          filter: `session_id=eq.${sessionId}`,
        },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ["session-tasks", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["session-details", sessionId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  // Mutation: Trigger agent execution loop (run or resume)
  const runAgentMutation = useMutation({
    mutationFn: async (variables: { projectId: string; prompt: string; title?: string }) => {
      if (sessionId) {
        return agentService.resumeAgentRun(sessionId, variables.prompt);
      }
      return agentService.startAgentRun(variables.projectId, variables.prompt, {
        title: variables.title,
      });
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ["session-details", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["session-tasks", sessionId] });
      }
    },
  });

  // Mutation: Fork session
  const forkSessionMutation = useMutation({
    mutationFn: (variables: { atMessageIndex: number }) =>
      agentService.forkAgentSession(sessionId!, variables.atMessageIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    session: (sessionQuery.data ?? null) as AgentSessionData | null,
    isSessionLoading: sessionQuery.isLoading,
    sessionError: sessionQuery.error,

    tasks: (tasksQuery.data ?? []) as AgentTaskData[],
    areTasksLoading: tasksQuery.isLoading,

    sendPrompt: runAgentMutation.mutateAsync,
    isSending: runAgentMutation.isPending,

    forkSession: forkSessionMutation.mutateAsync,
    isForking: forkSessionMutation.isPending,
  };
};
