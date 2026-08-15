/**
 * frontend/src/hooks/useFileTree.ts
 * ---------------------------------------------------------------------------
 * A project's files as a nested explorer tree.
 *
 * This used to walk Supabase Storage directly. The buckets are private and
 * their RLS grants the client nothing, so `list` returned zero entries without
 * an error: every real user saw an empty project and no reason why. The paths
 * now come from the project-files function, which is also what the preview and
 * the "@" file picker use — one source of truth, one ownership check.
 * ---------------------------------------------------------------------------
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectFiles } from "../services/fileService";
import { buildFileTree } from "../services/fileTree";

export type { FileNode } from "../services/fileTree";

export const useFileTree = (projectId: string) => {
  const queryClient = useQueryClient();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const fileTreeQuery = useQuery({
    queryKey: ["file-tree", projectId],
    queryFn: async () => {
      const files = await getProjectFiles(projectId);
      // .keep is the placeholder blob that keeps an empty prefix alive.
      return buildFileTree(Object.keys(files).filter((path) => !path.endsWith(".keep")));
    },
    enabled: !!projectId,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["file-tree", projectId] });
  };

  return {
    tree: fileTreeQuery.data || [],
    isLoading: fileTreeQuery.isLoading,
    error: fileTreeQuery.error,
    expandedFolders,
    toggleFolder,
    refresh,
  };
};
