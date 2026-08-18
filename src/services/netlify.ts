/**
 * frontend/src/services/netlify.ts
 * ---------------------------------------------------------------------------
 * Publishing a project to Netlify's free tier.
 *
 * The call goes straight from the app to api.netlify.com. That is not a shortcut —
 * it is the point. Netlify answers browser origins (`Access-Control-Allow-Origin:
 * *`, measured, not assumed), so the user's token never reaches our server, our
 * database or our logs. Nothing to encrypt, nothing to leak in a dump, and no
 * migration needed to ship it.
 *
 * The whole deploy is one request: POST /api/v1/sites with a zip body creates the
 * site and publishes it. Vercel cannot be done this way — its API wants each file
 * hashed and uploaded separately — which is why Netlify is first.
 *
 * The pure parts live here so they can be tested without a token: naming, and
 * reading Netlify's answer.
 * ---------------------------------------------------------------------------
 */

const API = "https://api.netlify.com/api/v1";

/** A slow upload on a phone network still has to finish. */
const DEPLOY_TIMEOUT_MS = 120_000;

/**
 * A site name Netlify will accept, derived from the project's own name.
 *
 * Netlify subdomains are lowercase letters, digits and hyphens. A random suffix is
 * appended because the namespace is global — "bakery" is long gone, and a name
 * collision fails the deploy with a message about the name rather than anything
 * the user did.
 */
export function siteNameFor(projectName: string, random: () => number = Math.random): string {
  const base = projectName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  const suffix = Math.floor(random() * 1_679_616).toString(36).padStart(4, "0").slice(0, 4);
  return `${base || "retro-app"}-${suffix}`;
}

/** Netlify tokens are opaque; this only rejects obvious non-tokens. */
export function looksLikeNetlifyToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 20 && !/\s/.test(trimmed);
}

export interface DeployResult {
  ok: boolean;
  /** The live address, once it exists. */
  url?: string;
  /** Netlify's admin page for the site, so the user can manage what they made. */
  adminUrl?: string;
  siteName?: string;
  /** Something a person can act on. */
  error?: string;
}

/**
 * Turn Netlify's answer into something worth showing.
 *
 * Kept separate from the request so every branch can be tested against the real
 * shapes rather than inferred from documentation.
 */
export function readDeployResponse(status: number, body: unknown): DeployResult {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (status === 200 || status === 201) {
    const url = typeof data.ssl_url === "string" ? data.ssl_url
      : typeof data.url === "string" ? data.url
      : undefined;
    if (!url) {
      return { ok: false, error: "Netlify accepted the upload but did not return an address." };
    }
    return {
      ok: true,
      url,
      adminUrl: typeof data.admin_url === "string" ? data.admin_url : undefined,
      siteName: typeof data.name === "string" ? data.name : undefined,
    };
  }

  // The message Netlify sends is usually the useful one; these add what to do.
  const detail = typeof data.message === "string" ? data.message
    : typeof data.error === "string" ? data.error
    : "";

  if (status === 401) {
    return { ok: false, error: "Netlify rejected the token. Create a new personal access token and paste it again." };
  }
  if (status === 403) {
    return { ok: false, error: `Netlify refused this account: ${detail || "the token may not have permission to create sites."}` };
  }
  if (status === 422) {
    return { ok: false, error: `Netlify would not accept the site: ${detail || "the name may already be taken."}` };
  }
  if (status === 429) {
    return { ok: false, error: "Netlify is rate limiting this token. Wait a few minutes and try again." };
  }
  return { ok: false, error: detail || `Netlify answered ${status}.` };
}

/**
 * Create a site and publish the zip to it, in one request.
 *
 * @param zip   The project, exactly as the download button produces it.
 * @param token The user's own Netlify personal access token. Sent to Netlify and
 *              nowhere else.
 */
export async function deployZipToNetlify(
  zip: Blob,
  siteName: string,
  token: string,
): Promise<DeployResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEPLOY_TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/sites?name=${encodeURIComponent(siteName)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: zip,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Netlify occasionally answers HTML for an infrastructure error.
      return { ok: false, error: `Netlify answered ${response.status} with ${text.slice(0, 120)}` };
    }
    return readDeployResponse(response.status, parsed);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The upload to Netlify timed out. Check the connection and try again." };
    }
    return {
      ok: false,
      error: `Could not reach Netlify: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
