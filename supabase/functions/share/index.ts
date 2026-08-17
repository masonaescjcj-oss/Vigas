/**
 * supabase/functions/share/index.ts
 * ---------------------------------------------------------------------------
 * Publishing a build to a link you can send someone.
 *
 * Someone builds an app on their phone and today cannot show it to anybody.
 * This closes that loop: one tap, one public URL.
 *
 * The document arrives from the client — the very HTML it is already rendering
 * in the preview — so what gets shared is what the user saw. The alternative,
 * bundling again on the server, would mean a second implementation of
 * previewBuilder/bundlePreview in Deno, and two bundlers drift.
 *
 * That does mean this endpoint hosts arbitrary HTML on our domain, which is a
 * real abuse surface (phishing pages are exactly this shape). What stands
 * against it: only signed-in users can publish, the rate limit is low, every
 * share is attributed to a row with a user_id, and revoke removes the object.
 * If abuse shows up, the lever is that row — not a content filter, which would
 * never hold anyway.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { ShareSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser, supabaseUrl } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { assertProjectOwner } from "../shared/agentRuntime.ts";
import {
  generateShareCode,
  isShareCode,
  prepareShareDocument,
  shareUrl,
} from "../shared/shareDoc.ts";

const BUCKET = "shared-apps";

/** How long a published page may be served from cache. */
const CACHE_SECONDS = 300;

/**
 * The feature needs a migration. Until it is applied, every call would fail as
 * an "unexpected server error" and send the operator looking in the wrong
 * place — so name what is actually missing.
 */
function asMissingTable(error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "42P01") {
    throw new AppError(
      503,
      "SHARING_NOT_MIGRATED",
      "Sharing needs a database migration that has not been applied yet (shares).",
    );
  }
}

/**
 * Claim a code by inserting the row before the document is uploaded.
 *
 * The primary key is what makes the claim exclusive, so two simultaneous
 * publishes cannot land on the same code — a retry loop around a duplicate-key
 * error is the whole mechanism. Six attempts is far more than 44 bits of
 * entropy ever needs; it exists so a genuinely broken generator fails loudly
 * instead of spinning.
 */
async function claimCode(
  service: ReturnType<typeof createServiceClient>,
  row: { project_id: string; user_id: string; title: string | null; size_bytes: number },
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateShareCode();
    const { error } = await service.from("shares").insert({ code, ...row });
    if (!error) return code;
    if (error.code !== "23505") {
      asMissingTable(error);
      throw error;
    }
  }
  throw new AppError(503, "SHARE_CODE_UNAVAILABLE", "Could not allocate a share link. Please try again.");
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, ShareSchema);
    const service = createServiceClient();

    // Publishing writes to a public bucket, so it is limited far harder than
    // reading the list back.
    await enforceRateLimit(service, `share:${input.action}`, user.id, input.action === "create" ? 10 : 60, 60);

    if (input.action === "list") {
      const { data, error } = await service
        .from("shares")
        .select("code,project_id,title,size_bytes,revoked_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) { asMissingTable(error); throw error; }

      const base = supabaseUrl();
      return json({
        shares: (data ?? []).map((share) => ({
          ...share,
          url: share.revoked_at ? null : shareUrl(base, String(share.code)),
        })),
      }, 200, headers);
    }

    if (input.action === "revoke") {
      // Validated against the alphabet before it reaches Storage: the code
      // becomes a path segment, and a path segment from a client is a path
      // traversal waiting to happen.
      if (!isShareCode(input.code!)) {
        throw new AppError(400, "INVALID_SHARE_CODE", "That is not a share code.");
      }

      // Ownership is the `eq(user_id)` here — the row is only marked when it is
      // the caller's. Nothing is removed from Storage until that succeeds.
      const { data, error } = await service
        .from("shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("code", input.code!)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .select("code")
        .maybeSingle();
      if (error) { asMissingTable(error); throw error; }
      if (!data) throw new AppError(404, "SHARE_NOT_FOUND", "That link is not yours, or is already taken down.");

      const removal = await service.storage.from(BUCKET).remove([`${input.code}.html`]);
      if (removal.error) {
        // The row is already revoked, so the link is gone from the app's point
        // of view; the object being slow to disappear is worth saying out loud
        // rather than hiding behind a success.
        console.error(`[share] revoked ${input.code} but storage removal failed: ${removal.error.message}`);
      }

      // Supabase's CDN serves public objects for the cacheControl window, so a
      // page can still answer for a few minutes after this returns. Promising
      // instant takedown would be a lie.
      return json({ ok: true, cacheSeconds: CACHE_SECONDS }, 200, headers);
    }

    // create
    await assertProjectOwner(service, user.id, input.projectId!);

    const prepared = prepareShareDocument(input.html!);
    if (!prepared.ok) throw new AppError(400, "SHARE_REJECTED", prepared.reason!);

    const code = await claimCode(service, {
      project_id: input.projectId!,
      user_id: user.id,
      title: input.title ?? null,
      size_bytes: prepared.bytes!,
    });

    const upload = await service.storage.from(BUCKET).upload(
      `${code}.html`,
      new Blob([prepared.document!], { type: "text/html" }),
      { upsert: true, contentType: "text/html; charset=utf-8", cacheControl: String(CACHE_SECONDS) },
    );

    if (upload.error) {
      // The row was claimed first, so a failed upload would otherwise leave a
      // code pointing at nothing. Take it back.
      await service.from("shares").delete().eq("code", code);
      if (/bucket not found/i.test(upload.error.message)) {
        throw new AppError(
          503,
          "SHARING_NOT_MIGRATED",
          "Sharing needs a database migration that has not been applied yet (the shared-apps bucket).",
        );
      }
      throw new AppError(502, "SHARE_UPLOAD_FAILED", `Could not publish the page: ${upload.error.message}`);
    }

    return json({
      code,
      url: shareUrl(supabaseUrl(), code),
      sizeBytes: prepared.bytes,
    }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("share", handler));
}
