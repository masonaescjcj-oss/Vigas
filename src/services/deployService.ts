/**
 * frontend/src/services/deployService.ts
 * ---------------------------------------------------------------------------
 * Putting a project on the internet.
 *
 * The zip comes from our own export endpoint — the same bytes the download button
 * produces, already verified to unzip correctly — and goes straight from the device
 * to Netlify. Our server builds the archive and never sees the token; Netlify
 * receives the token and never sees our database.
 * ---------------------------------------------------------------------------
 */

import { exportProject } from "./exportService";
import { deployZipToNetlify, siteNameFor, type DeployResult } from "./netlify";
import { loadNetlifyToken } from "./deployToken";

export type { DeployResult };

/**
 * Deploy a project, end to end.
 *
 * @returns A DeployResult rather than throwing, because every failure here is
 *          something to show the user, not an exception to swallow.
 */
export async function deployProject(
  projectId: string,
  projectName: string,
): Promise<DeployResult & { needsToken?: boolean }> {
  const token = await loadNetlifyToken();
  if (!token) {
    // Not an error: the user simply has not connected an account yet, and the
    // caller shows the token sheet rather than a failure.
    return { ok: false, needsToken: true };
  }

  let zip: Blob;
  try {
    // The export endpoint returns a short-lived signed URL; fetching it here keeps
    // one definition of "the project as files" instead of a second archiver.
    const exported = await exportProject(projectId);
    const response = await fetch(exported.url);
    if (!response.ok) {
      return { ok: false, error: `Could not read the project archive (${response.status}).` };
    }
    zip = await response.blob();
  } catch (error) {
    return {
      ok: false,
      error: `Could not build the project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return await deployZipToNetlify(zip, siteNameFor(projectName), token);
}
