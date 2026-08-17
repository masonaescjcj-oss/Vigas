/**
 * A share link is public and permanent-ish, so the parts that must not go wrong
 * are the code (unguessable, readable aloud), the size ceiling, and the
 * attribution — which the publisher must not be able to strip by sending
 * cleverly shaped HTML.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CODE_LENGTH,
  MAX_SHARE_BYTES,
  generateShareCode,
  isShareCode,
  prepareShareDocument,
  shareUrl,
} from "../shared/shareDoc.ts";

Deno.test("a code is the right length and readable aloud", () => {
  const code = generateShareCode();
  assertEquals(code.length, CODE_LENGTH);
  // 0/O and 1/l/I are where reading a link off a screen goes wrong.
  for (const ambiguous of ["0", "o", "1", "l", "i"]) {
    assertEquals(code.includes(ambiguous), false, `contains ${ambiguous}: ${code}`);
  }
});

Deno.test("codes differ across many draws", () => {
  const seen = new Set(Array.from({ length: 500 }, () => generateShareCode()));
  // Collisions at 44 bits over 500 draws would mean the generator is broken.
  assertEquals(seen.size, 500);
});

Deno.test("a code round-trips through validation", () => {
  assertEquals(isShareCode(generateShareCode()), true);
});

Deno.test("anything that is not a code is refused", () => {
  assertEquals(isShareCode("short"), false);
  assertEquals(isShareCode("abcdefgh0"), false, "ambiguous glyph");
  assertEquals(isShareCode("ABCDEFGHJ"), false, "uppercase");
  assertEquals(isShareCode("../../etc/x"), false);
  assertEquals(isShareCode(""), false);
  assertEquals(isShareCode(null), false);
  assertEquals(isShareCode(42), false);
});

Deno.test("attribution is added inside the body", () => {
  const result = prepareShareDocument("<html><body><h1>hi</h1></body></html>");
  assertEquals(result.ok, true);
  assertStringIncludes(result.document!, "Built with Retro Code");
  // Inside the body, not trailing after </html>, or a page with its own layout
  // pushes the badge off-screen.
  const badge = result.document!.indexOf("__retrocode_badge");
  assertEquals(badge < result.document!.indexOf("</body>"), true);
});

Deno.test("a document without a body tag still gets attribution", () => {
  const result = prepareShareDocument("<h1>just a fragment</h1>");
  assertEquals(result.ok, true);
  assertStringIncludes(result.document!, "Built with Retro Code");
});

Deno.test("the badge is added once even when the page mentions body twice", () => {
  const html = "<body><p>the word </body> appears in text</p></body>";
  const result = prepareShareDocument(html);
  const occurrences = result.document!.split("__retrocode_badge").length - 1;
  assertEquals(occurrences, 1);
});

Deno.test("an empty document is refused with a reason a user can act on", () => {
  const result = prepareShareDocument("   ");
  assertEquals(result.ok, false);
  assertStringIncludes(result.reason!, "build something");
});

Deno.test("an oversized document is refused, and says how big it was", () => {
  const result = prepareShareDocument("x".repeat(MAX_SHARE_BYTES + 1));
  assertEquals(result.ok, false);
  assertStringIncludes(result.reason!, "KB");
});

Deno.test("a document just under the ceiling is accepted", () => {
  const result = prepareShareDocument("x".repeat(MAX_SHARE_BYTES - 1000));
  assertEquals(result.ok, true);
});

Deno.test("the reported size counts the injected badge, not just the input", () => {
  const html = "<body>hi</body>";
  const result = prepareShareDocument(html);
  assertEquals(result.bytes! > new TextEncoder().encode(html).length, true);
});

Deno.test("the url points at the public bucket and tolerates a trailing slash", () => {
  assertEquals(
    shareUrl("https://x.supabase.co", "abcdefghj"),
    "https://x.supabase.co/storage/v1/object/public/shared-apps/abcdefghj.html",
  );
  assertEquals(
    shareUrl("https://x.supabase.co/", "abcdefghj"),
    "https://x.supabase.co/storage/v1/object/public/shared-apps/abcdefghj.html",
  );
});
