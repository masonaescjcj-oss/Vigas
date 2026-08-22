/**
 * supabase/functions/share-page/index.ts
 * ---------------------------------------------------------------------------
 * Serving a published page.
 *
 * This function exists because of a platform fact I discovered by measuring it:
 * **Supabase Storage refuses to serve `text/html`.** Upload a page with
 * `Content-Type: text/html` to a public bucket and it comes back as
 * `text/plain` — while `image/svg+xml`, `text/css` and `application/json` all
 * pass through untouched. It is a deliberate protection: arbitrary user HTML
 * served as HTML from `*.supabase.co` would make their domain a phishing host.
 *
 * So the original design — a public bucket and a direct object URL — could never
 * have worked. A shared "app" would have rendered as its own source code. An
 * edge function controls its own response, so the page is read from a now-private
 * bucket with the service key and returned with the right type.
 *
 * That means the risk Supabase was protecting against is ours to carry. What
 * stands against it: only signed-in users can publish, publishing is rate
 * limited, every page is attributed to a user_id, and revoking deletes the
 * object — which is also what makes a link stop working here, since this reads
 * the object rather than any row.
 *
 * Deploy with --no-verify-jwt: the whole point is that a stranger with a link can
 * open it.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { corsHeaders } from "../shared/http.ts";
import { createServiceClient } from "../shared/supabase.ts";
import { isShareCode } from "../shared/shareDoc.ts";
import { downloadBlob } from "../shared/storage.ts";

const BUCKET = "shared-apps";

/** Matches the cacheControl the publisher sets, so revocation is bounded. */
const CACHE_SECONDS = 300;

function page(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The page is attacker-controlled by definition. Stop a browser deciding
      // it is something more dangerous than what we labelled it.
      "x-content-type-options": "nosniff",
      // It is someone's app, not ours — keep it out of frames on our own origin
      // and out of referrer trails.
      "referrer-policy": "no-referrer",
      ...extra,
    },
  });
}

/** A refusal a person might actually read, since this URL gets shared around. */
function notice(title: string, detail: string, status: number): Response {
  return page(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0E0F0F;color:#F3F3EE;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="text-align:center;padding:24px;max-width:32rem">
  <div style="width:8px;height:8px;border-radius:50%;background:#3FC1D3;margin:0 auto 20px"></div>
  <h1 style="font-size:1.25rem;margin:0 0 8px">${title}</h1>
  <p style="margin:0;opacity:.7;font-size:.9rem">${detail}</p>
</div></body></html>`,
    status,
    { "cache-control": "no-store" },
  );
}

export async function handler(req: Request): Promise<Response> {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return notice("Not available", "This link is opened, not posted to.", 405);
  }

  // Accepts /share-page/<code> and ?code=<code>, so the link can be tidy while
  // the query form stays available for the local gateway.
  const url = new URL(req.url);
  const fromPath = url.pathname.split("/").filter(Boolean).pop();
  const code = url.searchParams.get("code")
    ?? (fromPath && fromPath !== "share-page" ? fromPath : null);

  // Validated against the alphabet before it becomes a Storage path. A path
  // segment taken from a URL is a traversal waiting to happen.
  if (!isShareCode(code)) {
    return notice("Not a Retro Code link", "Check the link and try again.", 400);
  }

  const service = createServiceClient();

  // downloadBlob, not the SDK's download(): Supabase's Smart CDN keeps serving a
  // deleted object for up to a minute, so a plain read made revocation silently
  // fail — a page the owner had taken down kept loading. Measured, not guessed.
  // downloadBlob forces the origin with a unique cache key.
  let html: string;
  try {
    const blob = await downloadBlob(service, BUCKET, `${code}.html`);
    html = await blob.text();
  } catch {
    // Revoking deletes the object, so absence is the normal way a link ends.
    return notice(
      "This page is no longer shared",
      "The person who published it has taken it down.",
      404,
    );
  }

  return page(html, 200, {
    // Bounded on purpose, and revokeShare reports this same number: a browser
    // that already has the page may show it for this long after a takedown.
    "cache-control": `public, max-age=${CACHE_SECONDS}`,
  });
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("share-page", handler));
}
