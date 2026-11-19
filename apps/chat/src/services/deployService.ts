/**
 * frontend/src/services/deployService.ts
 * ---------------------------------------------------------------------------
 * Putting a project on the internet, on whichever host the user connected.
 *
 * Both providers answer browser origins, so in both cases the token goes from the
 * device to the host and never touches our server. What differs is the payload, and
 * it is worth knowing which is which:
 *
 *   Netlify takes the whole zip — the same archive the download button produces, so
 *   every file goes, binary assets included.
 *
 *   Vercel takes no zip. Its API wants a file list, and this inlines the project's
 *   *text* files, which is what a phone-built static site is. A binary asset the
 *   agent could not have written itself would not be included.
 *
 * Netlify is therefore the more complete of the two, and the sheet says so.
 * ---------------------------------------------------------------------------
 */

import { exportProject } from "./exportService";
import { getProjectFiles } from "./fileService";
import { deployZipToNetlify, siteNameFor, type DeployResult } from "./netlify";
import { deployFilesToVercel, inlineFilesFrom, vercelProjectName } from "./vercel";
import { loadDeployToken, type DeployProvider } from "./deployToken";

export type { DeployResult, DeployProvider };

export interface DeployOutcome extends DeployResult {
  /** No account connected yet — the caller shows the connect sheet, not an error. */
  needsToken?: boolean;
  provider?: DeployProvider;
}

/** Where a project's live address ends up, per host. */
export const PROVIDER_LABEL: Record<DeployProvider, string> = {
  netlify: "Netlify",
  vercel: "Vercel",
};

export async function deployProject(
  projectId: string,
  projectName: string,
  provider: DeployProvider = "netlify",
): Promise<DeployOutcome> {
  const token = await loadDeployToken(provider);
  if (!token) return { ok: false, needsToken: true, provider };

  if (provider === "vercel") {
    let files: Record<string, string>;
    try {
      files = await getProjectFiles(projectId);
    } catch (error) {
      return {
        ok: false,
        provider,
        error: `Could not read the project: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const result = await deployFilesToVercel(inlineFilesFrom(files), vercelProjectName(projectName), token);
    return { ...result, provider };
  }

  let zip: Blob;
  try {
    // The export endpoint returns a short-lived signed URL; fetching it here keeps
    // one definition of "the project as files" instead of a second archiver.
    const exported = await exportProject(projectId);
    const response = await fetch(exported.url);
    if (!response.ok) {
      return { ok: false, provider, error: `Could not read the project archive (${response.status}).` };
    }
    zip = await response.blob();
  } catch (error) {
    return {
      ok: false,
      provider,
      error: `Could not build the project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const result = await deployZipToNetlify(zip, siteNameFor(projectName), token);
  return { ...result, provider };
}
