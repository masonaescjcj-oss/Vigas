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

      /**
       * Storage `list` is not recursive, so the old single-depth version showed
       * folders that could never be opened. Walk the tree instead and attach
       * children, capped so a pathological project can't spin forever.
       */
      const MAX_DEPTH = 6;
      const MAX_REQUESTS = 200;
      let requests = 0;

      const walk = async (directory: string, depth: number): Promise<FileNode[]> => {
        if (depth > MAX_DEPTH || requests >= MAX_REQUESTS) return [];
        requests += 1;

        const { data, error } = await supabase.storage
          .from("project-files")
          .list(directory, { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (error) throw error;

        const nodes: FileNode[] = [];
        for (const item of data ?? []) {
          // Supabase represents a folder as an entry with a null id.
          const isDir = item.id === null;
          const path = `${directory}/${item.name}`;
          if (item.name === ".keep") continue; // placeholder blob, not a real file
          nodes.push({
            name: item.name,
            path,
            isDir,
            children: isDir ? await walk(path, depth + 1) : undefined,
          });
        }
        // Folders first, then files — the conventional file-tree ordering.
        return nodes.sort((a, b) =>
          a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
        );
      };

      return await walk(prefix, 0);
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
