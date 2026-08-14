/**
 * frontend/src/services/fileService.ts
 * ---------------------------------------------------------------------------
 * Fetches a project's text files (the preview bundle) through the
 * project-files edge function — same code path locally (Deno gateway) and
 * against the deployed backend.
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export async function getProjectFiles(projectId: string): Promise<Record<string, string>> {
  const data = await invokeFunction<{ files?: Record<string, string> }>("project-files", {
    body: { projectId },
  });
  return data.files ?? {};
}

export interface ProjectFileEntry {
  path: string;
  name: string;
  /** Directory depth, 0 for files at the project root. */
  depth: number;
  sizeLabel: string;
  ext: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Flat, sorted file list for the file-tree sheet, derived from the real bundle. */
export function toFileEntries(files: Record<string, string>): ProjectFileEntry[] {
  return Object.entries(files)
    .map(([path, contents]) => {
      const segments = path.split("/");
      const name = segments[segments.length - 1];
      return {
        path,
        name,
        depth: segments.length - 1,
        sizeLabel: formatSize(new TextEncoder().encode(contents).length),
        ext: (name.includes(".") ? name.split(".").pop()! : "").toUpperCase(),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
