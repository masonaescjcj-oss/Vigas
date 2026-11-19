/**
 * scripts/make-legal-pages.mjs
 * ---------------------------------------------------------------------------
 * Render the privacy policy and terms to standalone HTML.
 *
 * Google Play requires a privacy policy at a URL a reviewer can open without
 * installing anything. The app has the text on a screen, but the screen is
 * behind React Navigation inside a single-page bundle: /privacy served
 * index.html, the router did not recognise the path, and it fell through to
 * onboarding. A reviewer following the link would have seen a splash screen.
 *
 * These pages need no JavaScript, so they work for a crawler, a reviewer with
 * scripts blocked, and anyone on a bad connection. They are generated from
 * core/legal/documents, which is also what the in-app screens render, so the
 * published policy cannot drift from the one users are shown.
 *
 * The extensionless paths are what goes on the store listing: /privacy reads
 * better than /privacy.html and does not tie the listing to a file layout.
 *
 *   node scripts/make-legal-pages.mjs [dist-dir]
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv[2] ?? "dist-web";

if (!existsSync(DIST)) {
  console.error(`No ${DIST} — run \`expo export --platform web\` first.`);
  process.exit(1);
}

/**
 * Read the documents out of the TypeScript source.
 *
 * Deliberately a parse rather than an import: this script is plain Node run
 * from a shell step, and pulling in a TypeScript toolchain to read two string
 * literals would be the larger dependency. The shapes are simple and the file
 * is ours, so a targeted extraction is honest here — and if it ever fails to
 * find a document it exits rather than publishing an empty policy.
 */
const source = readFileSync("src/core/legal/documents.ts", "utf8");

function extractDocument(constName) {
  const start = source.indexOf(`export const ${constName}: LegalDocument = {`);
  if (start === -1) throw new Error(`${constName} not found in documents.ts`);

  // Everything to the closing "};" at column 0 — the file is formatted, and a
  // brace counter would be more machinery for no more certainty.
  const end = source.indexOf("\n};", start);
  if (end === -1) throw new Error(`${constName} is not terminated`);
  const block = source.slice(start, end);

  const title = /title:\s*"([^"]+)"/.exec(block)?.[1];
  const updated = /updated:\s*LAST_UPDATED/.test(block)
    ? /export const LAST_UPDATED = "([^"]+)"/.exec(source)?.[1]
    : /updated:\s*"([^"]+)"/.exec(block)?.[1];

  // Intro and body strings are written as adjacent literals joined by +.
  const introRaw = /intro:\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)/.exec(block)?.[1] ?? "";
  const intro = joinLiterals(introRaw);

  const sections = [];
  const sectionRe = /heading:\s*"([^"]+)",\s*body:\s*\[([\s\S]*?)\],\s*\}/g;
  let match;
  while ((match = sectionRe.exec(block)) !== null) {
    const lines = [];
    const lineRe = /((?:"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)\s*\+?\s*)+/g;
    let lineMatch;
    while ((lineMatch = lineRe.exec(match[2])) !== null) {
      const text = joinLiterals(lineMatch[0]);
      if (text) lines.push(text);
    }
    sections.push({ heading: match[1], body: lines });
  }

  if (!title || !sections.length) throw new Error(`${constName} parsed to nothing usable`);
  return { title, updated, intro, sections };
}

/** Concatenate adjacent string literals, resolving the one interpolation used. */
function joinLiterals(raw) {
  const email = /export const SUPPORT_EMAIL = "([^"]+)"/.exec(source)?.[1] ?? "";
  return raw
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.startsWith('"') || part.startsWith("`"))
    .map((part) => part.slice(1, -1))
    .join("")
    .replaceAll("${SUPPORT_EMAIL}", email)
    .replaceAll('\\"', '"')
    .trim();
}

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** **bold** is the only markup the documents use. */
const rich = (s) =>
  escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

function render(doc) {
  const body = doc.sections
    .map((section) => {
      const bullets = section.body.filter((l) => l.startsWith("- "));
      const paragraphs = section.body.filter((l) => !l.startsWith("- "));
      return [
        `<h2>${escapeHtml(section.heading)}</h2>`,
        ...paragraphs.map((p) => `<p>${rich(p)}</p>`),
        bullets.length
          ? `<ul>${bullets.map((b) => `<li>${rich(b.slice(2))}</li>`).join("")}</ul>`
          : "",
      ].join("\n");
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)} — RetroAI</title>
<meta name="description" content="${escapeHtml(doc.intro).slice(0, 160)}">
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 40px 20px 80px; max-width: 46rem;
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #fcfcf9; color: #13343b;
  }
  @media (prefers-color-scheme: dark) { body { background: #1b1c1c; color: #e7e7e0; } }
  header { border-bottom: 1px solid rgba(128,128,128,.25); padding-bottom: 20px; margin-bottom: 8px; }
  h1 { font-size: 1.6rem; margin: 0 0 6px; }
  h2 { font-size: 1.05rem; margin: 34px 0 8px; }
  p, li { margin: 8px 0; }
  ul { padding-left: 1.2rem; }
  .muted { opacity: .6; font-size: .85rem; margin: 0; }
  a { color: inherit; }
  footer { margin-top: 56px; font-size: .85rem; opacity: .6; }
</style>
</head>
<body>
<header>
  <h1>RetroAI — ${escapeHtml(doc.title)}</h1>
  <p class="muted">Last updated ${escapeHtml(doc.updated ?? "")}</p>
</header>
<p>${rich(doc.intro)}</p>
${body}
<footer><p><a href="/">RetroAI</a></p></footer>
</body>
</html>
`;
}

const pages = [
  ["privacy", "PRIVACY_POLICY"],
  ["terms", "TERMS_OF_SERVICE"],
];

for (const [slug, constName] of pages) {
  const html = render(extractDocument(constName));
  // Both spellings: the extensionless one is what the listing links to, and
  // the .html one is what a static host serves without any rewrite at all.
  writeFileSync(join(DIST, `${slug}.html`), html);
  writeFileSync(join(DIST, slug), html);
}

console.log(`Legal pages written to ${DIST}/ (${pages.map(([s]) => `/${s}`).join(", ")})`);
