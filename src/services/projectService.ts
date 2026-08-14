/**
 * frontend/src/services/projectService.ts
 * ---------------------------------------------------------------------------
 * CRUD for projects via Edge Functions (and RLS table access for updates).
 * Errors are surfaced to the caller — no mock/local-storage fallbacks.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import { invokeFunction } from "./functionsClient";

export interface Project {
  id: string;
  name: string;
  description?: string;
  sandbox_path: string;
  last_opened_at: string;
  created_at: string;
}

export const projectService = {
  /** Fetch all projects belonging to the authenticated user. */
  async getProjects(): Promise<Project[]> {
    const data = await invokeFunction<{ projects?: Project[] }>("projects-list", {
      method: "GET",
    });
    return data.projects ?? [];
  },

  /** Create a new project using the projects-create Edge Function. */
  async createProject(name: string, description?: string): Promise<Project> {
    const data = await invokeFunction<{ project?: Project } & Project>("projects-create", {
      body: { name, description },
    });
    return (data.project ?? data) as Project;
  },

  /** Update project details (RLS: owner only). */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update({ ...updates, last_opened_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Project;
  },

  /** Delete a project and clean up its storage via the projects-delete Edge Function. */
  async deleteProject(id: string): Promise<void> {
    await invokeFunction("projects-delete", {
      method: "DELETE",
      body: { projectId: id },
    });
  },
};
