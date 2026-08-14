/**
 * frontend/src/services/projectService.ts
 * ---------------------------------------------------------------------------
 * Service to handle CRUD operations on projects by interacting with Supabase RLS
 * tables and dedicated Edge Functions.
 * ---------------------------------------------------------------------------
 */

import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../stores/authStore";

const LOCAL_API_URL = "http://localhost:54321/functions/v1";

async function localInvoke(functionName: string, options: any) {
  const storeSession = useAuthStore.getState().session;
  const token = storeSession?.access_token;
  
  const res = await fetch(`${LOCAL_API_URL}/${functionName}`, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    ...(options.method === "GET" ? {} : { body: JSON.stringify(options.body) })
  });
  
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = await res.text(); } catch(e) {}
    return { error: new Error(msg), data: null };
  }
  return { error: null, data: await res.json() };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  sandbox_path: string;
  last_opened_at: string;
  created_at: string;
}

const LOCAL_PROJECTS_KEY = "@issac:projects";

const getLocalProjects = async (): Promise<Project[]> => {
  try {
    const data = await AsyncStorage.getItem(LOCAL_PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load local projects", e);
    return [];
  }
};

const saveLocalProjects = async (projects: Project[]) => {
  try {
    await AsyncStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Failed to save local projects", e);
  }
};

export const projectService = {
  /** Fetch all projects belonging to the authenticated user. */
  async getProjects(): Promise<Project[]> {
    try {
      const { data, error } = await localInvoke("projects-list", {
        method: "GET",
      });

      if (error || !data) throw new Error(error?.message || "Failed to list projects");
      return data.projects || [];
    } catch (e) {
      console.warn("Falling back to local storage for getProjects", e);
      return getLocalProjects();
    }
  },

  /** Create a new project using the projects-create Edge Function. */
  async createProject(name: string, description?: string): Promise<Project> {
    try {
      const { data, error } = await localInvoke("projects-create", {
        method: "POST",
        body: { name, description },
      });

      if (error || !data) {
        throw new Error(error?.message || "Failed to create project");
      }
      // The API returns { project: {...} }
      return (data.project || data) as Project;
    } catch (e) {
      console.warn("Falling back to local storage for createProject");
      const localProjects = await getLocalProjects();
      const newProj: Project = {
        id: "local-project-" + Math.random().toString(36).substring(2, 9),
        name,
        description,
        sandbox_path: `/workspace/${name.toLowerCase().replace(/\s+/g, "-")}`,
        last_opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      localProjects.unshift(newProj);
      await saveLocalProjects(localProjects);
      return newProj;
    }
  },

  /** Update project details. */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({ ...updates, last_opened_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (e) {
      console.warn("Falling back to local storage for updateProject");
      const localProjects = await getLocalProjects();
      const idx = localProjects.findIndex(p => p.id === id);
      if (idx !== -1) {
        localProjects[idx] = {
          ...localProjects[idx],
          ...updates,
          last_opened_at: new Date().toISOString(),
        };
        await saveLocalProjects(localProjects);
        return localProjects[idx];
      }
      throw new Error("Project not found locally");
    }
  },

  /** Delete a project and clean up its storage via the projects-delete Edge Function. */
  async deleteProject(id: string): Promise<void> {
    try {
      const { error } = await localInvoke("projects-delete", {
        method: "DELETE",
        body: { projectId: id },
      });

      if (error) throw new Error(error.message);
    } catch (e) {
      console.warn("Falling back to local storage for deleteProject");
      const localProjects = await getLocalProjects();
      const filtered = localProjects.filter(p => p.id !== id);
      await saveLocalProjects(filtered);
    }
  },
};
