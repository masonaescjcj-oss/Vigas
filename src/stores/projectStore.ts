/**
 * frontend/src/stores/projectStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage active project state and sandbox statuses.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";

interface ProjectState {
  activeProjectId: string | null;
  activeProjectName: string | null;
  sandboxStatus: "idle" | "running" | "stopped";
  setActiveProject: (id: string, name: string) => void;
  setSandboxStatus: (status: "idle" | "running" | "stopped") => void;
  clearActiveProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  activeProjectName: null,
  sandboxStatus: "stopped",

  setActiveProject: (id, name) => set({ activeProjectId: id, activeProjectName: name }),
  setSandboxStatus: (status) => set({ sandboxStatus: status }),
  clearActiveProject: () => set({ activeProjectId: null, activeProjectName: null, sandboxStatus: "stopped" }),
}));
