/**
 * frontend/src/services/vercel.ts
 * ---------------------------------------------------------------------------
 * Publishing a project to Vercel's free tier.
 *
 * Same shape as the Netlify path and for the same measured reason: api.vercel.com
 * answers browser origins (`Access-Control-Allow-Origin: *` on both /v13/deployments
 * and /v2/files), so the token goes from the device to Vercel and never touches our
 * server.
 *
 * Where it differs: Vercel takes no zip. Its API wants a list of files, either
 * uploaded separately and referenced by SHA-1, or — and this is what makes the
 * feature reasonable to build — inlined in the request with `data` and `encoding`.
 * A phone-built static site is a handful of text files, so inlining avoids the
 * two-phase upload entirely.
 *
 * The consequence, stated plainly because it is a real difference from Netlify:
 * this sends the project's *text* files. A binary asset the agent could not have
 * written itself is not included. Netlify gets the whole zip and does not have that
 * limitation.
 * ---------------------------------------------------------------------------
 */

const API = "https://api.vercel.com";

const DEPLOY_TIMEOUT_MS = 120_000;

/** Above this, inlining stops being reasonable and the SHA upload path is needed. */
export const MAX_INLINE_BYTES = 3_000_000;

export interface VercelDeployResult {
  ok: boolean;
  url?: string;
  inspectorUrl?: string;
  projectName?: string;
  error?: string;
}

/**
 * A Vercel project name: lowercase, digits, hyphens, at most 100 characters.
 *
 * No random suffix here, unlike Netlify. A Vercel project name is scoped to the
 * account rather than global, so re-deploying the same project should land on the
 * same name and replace it rather than litter the account with copies.
 */
export function vercelProjectName(projectName: string): string {
  const base = projectName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/, "");
  return base || "retro-app";
}

export function looksLikeVercelToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 20 && !/\s/.test(trimmed);
}

export interface InlineFile {
  file: string;
  data: string;
  encoding: "utf-8";
}

/**
 * Turn the project's text files into what /v13/deployments accepts inline.
 *
 * Paths are made relative with no leading slash, which is what Vercel expects, and
 * `.keep` is dropped — it exists only so an empty folder survives in Storage.
 */
export function inlineFilesFrom(files: Record<string, string>): InlineFile[] {
  return Object.entries(files)
    .filter(([path]) => path && !path.endsWith(".keep"))
    .map(([path, contents]) => ({
      file: path.replace(/^\/+/, ""),
      data: contents,
      encoding: "utf-8" as const,
    }));
}

export function totalBytesOf(files: InlineFile[]): number {
  // Byte length, not string length: one Persian character is two bytes of UTF-8 and
  // a size check on `.length` would let a page through that is twice the limit.
  const encoder = new TextEncoder();
  return files.reduce((sum, entry) => sum + encoder.encode(entry.data).length, 0);
}

/**
 * Read Vercel's answer.
 *
 * A created deployment returns a hostname with no scheme, so one is added — nobody
 * should be handed a link they cannot tap.
 */
export function readVercelResponse(status: number, body: unknown): VercelDeployResult {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, any>;

  if (status >= 200 && status < 300) {
    const host = typeof data.url === "string" ? data.url
      : typeof data.alias?.[0] === "string" ? data.alias[0]
      : undefined;
    if (!host) {
      return { ok: false, error: "Vercel accepted the files but did not return an address." };
    }
    return {
      ok: true,
      url: host.startsWith("http") ? host : `https://${host}`,
      inspectorUrl: typeof data.inspectorUrl === "string" ? data.inspectorUrl : undefined,
      projectName: typeof data.name === "string" ? data.name : undefined,
    };
  }

  const detail = typeof data.error?.message === "string" ? data.error.message
    : typeof data.message === "string" ? data.message
    : "";

  if (status === 401 || status === 403) {
    return { ok: false, error: "Vercel rejected the token. Create a new one and paste it again." };
  }
  if (status === 400) {
    return { ok: false, error: `Vercel would not accept the deployment: ${detail || "the request was refused."}` };
  }
  if (status === 429) {
    return { ok: false, error: "Vercel is rate limiting this token. Wait a few minutes and try again." };
  }
  return { ok: false, error: detail || `Vercel answered ${status}.` };
}

/**
 * Create a production deployment from inlined files.
 *
 * @param token The user's own Vercel token. Sent to Vercel and nowhere else.
 */
export async function deployFilesToVercel(
  files: InlineFile[],
  projectName: string,
  token: string,
): Promise<VercelDeployResult> {
  if (files.length === 0) {
    return { ok: false, error: "There is nothing to deploy yet — build something first." };
  }
  const bytes = totalBytesOf(files);
  if (bytes > MAX_INLINE_BYTES) {
    return {
      ok: false,
      error: `This project is ${Math.round(bytes / 1024)} KB, over the ${Math.round(MAX_INLINE_BYTES / 1024)} KB limit for a Vercel deploy. Publish to Netlify instead, which takes the whole archive.`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEPLOY_TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/v13/deployments?skipAutoDetectionConfirmation=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({
        name: projectName,
        files,
        target: "production",
        // No framework: this is plain static output, and letting Vercel guess a
        // framework makes it look for a build step that does not exist.
        projectSettings: { framework: null },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: `Vercel answered ${response.status} with ${text.slice(0, 120)}` };
    }
    return readVercelResponse(response.status, parsed);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The upload to Vercel timed out. Check the connection and try again." };
    }
    return {
      ok: false,
      error: `Could not reach Vercel: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
