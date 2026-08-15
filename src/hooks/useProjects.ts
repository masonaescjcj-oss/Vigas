/**
 * frontend/src/hooks/useProjects.ts
 * ---------------------------------------------------------------------------
 * Custom hook to handle projects data querying and mutation using TanStack Query.
 * Reads and writes the real projects backend; there is no mock fallback.
 * ---------------------------------------------------------------------------
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectService, type Project } from "../services/projectService";

export const useProjects = () => {
  const queryClient = useQueryClient();

  // Query: Get all projects
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectService.getProjects(),
  });

  // Mutation: Create a project
  const createProjectMutation = useMutation({
    mutationFn: (variables: { name: string; description?: string; template?: string }) =>
      projectService.createProject(variables.name, variables.description, variables.template),
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
    projects: (projectsQuery.data ?? []) as Project[],
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
