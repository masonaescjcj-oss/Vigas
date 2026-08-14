/**
 * frontend/src/stores/chatStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage chat session states, streaming tokens, and
 * active permission requests from the agent.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";

interface PermissionRequest {
  id: string;
  toolName: string;
  reason: string;
  resolve: (approved: boolean) => void;
}

interface ChatState {
  activeSessionId: string | null;
  streamingToken: string | null;
  permissionRequest: PermissionRequest | null;
  isRunning: boolean;
  
  setActiveSession: (id: string | null) => void;
  setStreamingToken: (token: string | null) => void;
  setPermissionRequest: (req: PermissionRequest | null) => void;
  setIsRunning: (running: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  streamingToken: null,
  permissionRequest: null,
  isRunning: false,

  setActiveSession: (id) => set({ activeSessionId: id }),
  setStreamingToken: (token) => set({ streamingToken: token }),
  setPermissionRequest: (req) => set({ permissionRequest: req }),
  setIsRunning: (running) => set({ isRunning: running }),
}));
