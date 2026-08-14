/**
 * frontend/src/services/fileService.ts
 * ---------------------------------------------------------------------------
 * Fetches a project's text files (the preview bundle). In local dev this hits
 * the gateway's service-role endpoint; against the deployed backend it will
 * use a files edge function (Phase 3 roadmap item).
 * ---------------------------------------------------------------------------
 */

import { API_ORIGIN, IS_LOCAL_API } from "./functionsClient";

export async function getProjectFiles(projectId: string): Promise<Record<string, string>> {
  if (IS_LOCAL_API) {
    const res = await fetch(`${API_ORIGIN}/api/projects/${projectId}/bundle`);
    if (!res.ok) throw new Error(`Loading project files failed (${res.status})`);
    const data = (await res.json()) as { files?: Record<string, string> };
    return data.files ?? {};
  }
  throw new Error(
    "Live preview against the deployed backend needs the project-files edge function (Phase 3).",
  );
}
