/**
 * frontend/src/hooks/useProjects.ts
 * ---------------------------------------------------------------------------
 * Custom hook to handle projects data querying and mutation using TanStack Query.
 * Includes automatic fallback to MOCK_PROJECTS for rich UI/UX template preview.
 * ---------------------------------------------------------------------------
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectService, type Project } from "../services/projectService";
import { MOCK_PROJECTS } from "../services/mockData";

export const useProjects = () => {
  const queryClient = useQueryClient();

  // Query: Get all projects (Falls back to MOCK_PROJECTS if empty for UI Preview)
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        const live = await projectService.getProjects();
        return live && live.length > 0 ? live : MOCK_PROJECTS;
      } catch (e) {
        console.warn("UI Preview Mode: Using MOCK_PROJECTS");
        return MOCK_PROJECTS;
      }
    },
  });

  // Mutation: Create a project
  const createProjectMutation = useMutation({
    mutationFn: (variables: { name: string; description?: string }) =>
      projectService.createProject(variables.name, variables.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // Mutation: Update a project
  const updateProjectMutation = useMutation({
    mutationFn: (variables: { id: string; updates: Partial<Project> }) =>
      projectService.updateProject(variables.id, variables.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // Mutation: Delete a project
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    projects: projectsQuery.data || MOCK_PROJECTS,
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    refetch: projectsQuery.refetch,
    
    createProject: createProjectMutation.mutateAsync,
    isCreating: createProjectMutation.isPending,
    
    updateProject: updateProjectMutation.mutateAsync,
    isUpdating: updateProjectMutation.isPending,
    
    deleteProject: deleteProjectMutation.mutateAsync,
    isDeleting: deleteProjectMutation.isPending,
  };
};
