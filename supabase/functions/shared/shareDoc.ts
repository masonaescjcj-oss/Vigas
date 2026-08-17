/**
 * supabase/functions/shared/shareDoc.ts
 * ---------------------------------------------------------------------------
 * Turning a previewed document into a publishable one.
 *
 * Publishing arbitrary HTML to a public URL is, by nature, hosting other
 * people's pages — the same thing Replit and Bolt do, and the same abuse
 * surface. The mitigations that matter are elsewhere (auth, rate limits,
 * revocation); what happens here is the part that must be deterministic and
 * therefore testable:
 *
 *   - a short code that is unguessable and readable aloud
 *   - a size ceiling, so one share cannot fill the bucket
 *   - attribution the publisher cannot strip, injected server-side
 * ---------------------------------------------------------------------------
 */

/**
 * Ambiguous glyphs are left out: someone reads a share link off a screen, and
 * 0/O and 1/l/I are where that goes wrong.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 9 characters of this alphabet is ~44 bits — not enumerable. */
export const CODE_LENGTH = 9;

/** A published page is one document; anything larger is a project, not a page. */
export const MAX_SHARE_BYTES = 2_000_000;

export function generateShareCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

/** Codes come back from the client on revoke, so they are validated. */
export function isShareCode(value: unknown): value is string {
  return typeof value === "string" &&
    value.length === CODE_LENGTH &&
    [...value].every((character) => ALPHABET.includes(character));
}

export interface PrepareResult {
  ok: boolean;
  reason?: string;
  document?: string;
  bytes?: number;
}

/**
 * The badge added to every published page.
 *
 * Injected here rather than trusted from the client, so a page cannot be
 * published without it. Fixed position and a high z-index because the page's
 * own CSS is not ours to predict.
 */
function attribution(): string {
  return `
<div id="__retrocode_badge" style="position:fixed;right:12px;bottom:12px;z-index:2147483647;
  font:12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;background:rgba(14,15,15,0.86);
  color:#F3F3EE;padding:8px 12px;border-radius:999px;text-decoration:none;
  display:flex;align-items:center;gap:6px;box-shadow:0 2px 12px rgba(0,0,0,0.25)">
  <span style="width:6px;height:6px;border-radius:50%;background:#3FC1D3"></span>
  Built with Retro Code
</div>`;
}

/**
 * Check and finish a document for publishing.
 *
 * @param html What the user previewed — so what gets shared is what they saw.
 */
export function prepareShareDocument(html: string): PrepareResult {
  const trimmed = html.trim();
  if (!trimmed) {
    return { ok: false, reason: "There is nothing to share yet — build something first." };
  }

  const bytes = new TextEncoder().encode(trimmed).length;
  if (bytes > MAX_SHARE_BYTES) {
    return {
      ok: false,
      reason: `That page is ${Math.round(bytes / 1024)} KB, over the ${Math.round(MAX_SHARE_BYTES / 1024)} KB limit for a shared link.`,
    };
  }

  // Before </body> when there is one, so the badge lands inside the document
  // rather than after it; appended otherwise.
  const closing = trimmed.lastIndexOf("</body>");
  const document = closing === -1
    ? trimmed + attribution()
    : trimmed.slice(0, closing) + attribution() + trimmed.slice(closing);

  return { ok: true, document, bytes: new TextEncoder().encode(document).length };
}

/** The public URL a code resolves to. */
export function shareUrl(supabaseUrl: string, code: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/shared-apps/${code}.html`;
}
