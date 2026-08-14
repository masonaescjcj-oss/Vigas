/**
 * frontend/src/hooks/useFileTree.ts
 * ---------------------------------------------------------------------------
 * Hook to retrieve the project's sandbox files from Supabase Storage
 * and structure them as a nested explorer tree.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/authStore";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

export const useFileTree = (projectId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const prefix = `users/${user?.id}/projects/${projectId}`;

  const fileTreeQuery = useQuery({
    queryKey: ["file-tree", projectId],
    queryFn: async (): Promise<FileNode[]> => {
      if (!user) return [];
      
      // Fetch files list from storage
      const { data, error } = await supabase.storage
        .from("project-files")
        .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });

      if (error) throw error;
      
      const rootNodes: FileNode[] = [];

      // Process flat list into structured tree (MVP covers single depth folder listings)
      for (const item of data || []) {
        const itemPath = `${prefix}/${item.name}`;
        rootNodes.push({
          name: item.name,
          path: itemPath,
          isDir: item.id === null, // Supabase storage represents folders with null id
        });
      }
      
      return rootNodes;
    },
    enabled: !!user && !!projectId,
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
