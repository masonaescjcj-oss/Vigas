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

// Pure helpers live in ./formatting so they can be tested without a client.
export { toFileEntries, formatSize, type ProjectFileEntry } from "./formatting";
