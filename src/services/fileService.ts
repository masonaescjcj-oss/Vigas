/**
 * frontend/src/services/fileService.ts
 * ---------------------------------------------------------------------------
 * A project's files, read and written through the project-files edge function
 * — same code path locally (Deno gateway) and against the deployed backend.
 *
 * Nothing here talks to Storage directly on purpose: the buckets are private
 * and their RLS gives the client no access, so a direct read comes back
 * silently empty and a direct write is refused. Ownership is proven once, in
 * the function, and every file operation goes through it.
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export async function getProjectFiles(projectId: string): Promise<Record<string, string>> {
  const data = await invokeFunction<{ files?: Record<string, string> }>("project-files", {
    body: { projectId },
  });
  return data.files ?? {};
}

/** Create or overwrite one text file. */
export async function writeProjectFile(
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  await invokeFunction("project-files", { body: { projectId, action: "write", path, content } });
}

export async function deleteProjectFile(projectId: string, path: string): Promise<void> {
  await invokeFunction("project-files", { body: { projectId, action: "delete", path } });
}

export async function renameProjectFile(
  projectId: string,
  path: string,
  toPath: string,
): Promise<void> {
  await invokeFunction("project-files", { body: { projectId, action: "rename", path, toPath } });
}

// Pure helpers live in ./formatting so they can be tested without a client.
export { toFileEntries, formatSize, type ProjectFileEntry } from "./formatting";
