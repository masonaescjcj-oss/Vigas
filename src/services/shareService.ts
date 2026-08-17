/**
 * frontend/src/services/shareService.ts
 * ---------------------------------------------------------------------------
 * Publishing a build to a link.
 *
 * The HTML sent up is the document the preview is already rendering, so the
 * page a friend opens is the page the user just looked at. Nothing is rebuilt
 * on the server.
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export interface ShareRecord {
  code: string;
  project_id: string;
  title: string | null;
  size_bytes: number;
  revoked_at: string | null;
  created_at: string;
  /** Null once revoked — there is no URL left to open. */
  url: string | null;
}

export interface CreatedShare {
  code: string;
  url: string;
  sizeBytes: number;
}

export async function createShare(input: {
  projectId: string;
  html: string;
  title?: string;
}): Promise<CreatedShare> {
  return invokeFunction<CreatedShare>("share", {
    body: {
      action: "create",
      projectId: input.projectId,
      html: input.html,
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    },
  });
}

export async function listShares(): Promise<ShareRecord[]> {
  const data = await invokeFunction<{ shares?: ShareRecord[] }>("share", {
    body: { action: "list" },
  });
  return data.shares ?? [];
}

/**
 * Take a link down.
 *
 * `cacheSeconds` is how long the page may still be served from the CDN after
 * this returns — worth showing, because "revoked" that still loads for someone
 * else looks broken otherwise.
 */
export async function revokeShare(code: string): Promise<{ cacheSeconds: number }> {
  return invokeFunction<{ ok: boolean; cacheSeconds: number }>("share", {
    body: { action: "revoke", code },
  });
}
