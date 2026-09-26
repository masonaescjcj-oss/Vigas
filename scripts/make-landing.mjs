/**
 * scripts/make-landing.mjs
 * ---------------------------------------------------------------------------
 * Put the landing page, its share image, robots.txt and sitemap.xml into the
 * web export. Run by make-pwa.mjs after every export.
 *
 * The landing page is plain HTML (web/landing.html) rather than a screen of
 * the app, because the app is a JavaScript bundle that renders nothing until
 * it runs — a search engine, or a link preview, reading "/" would find an
 * empty page.
 *
 * It becomes index.html, and the app shell Expo exported as index.html moves
 * to app.html: Vercel serves a real file before any rewrite, so "/" can only
 * be the landing page by being index.html. vercel.json (written by make-pwa)
 * sends /app, and every path the app writes itself, to app.html.
 *
 *   node scripts/make-landing.mjs [dist-dir]
 * ---------------------------------------------------------------------------
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv[2] ?? "dist-web";
const ORIGIN = "https://retrobuild.space";

if (!existsSync("web/landing.html")) {
  console.error("missing web/landing.html");
  process.exit(1);
}

// Only move index.html while it is still the app shell, so a second run over
// the same export cannot move the landing page on top of the app.
const index = join(DIST, "index.html");
if (existsSync(index) && readFileSync(index, "utf8").includes("/_expo/static/")) {
  renameSync(index, join(DIST, "app.html"));
}
if (!existsSync(join(DIST, "app.html"))) {
  console.error(`no app shell in ${DIST}: run expo export and make-pwa first`);
  process.exit(1);
}
copyFileSync("web/landing.html", index);
// Drawn by scripts/make-brand-assets.py; the page names it as /og.png.
copyFileSync("assets/og-image.png", join(DIST, "og.png"));

writeFileSync(
  join(DIST, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    // The share proxy and the app's own paths are not pages worth indexing;
    // the app shell also says noindex itself.
    "Disallow: /api/",
    "",
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    "",
  ].join("\n"),
);

const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${ORIGIN}/`, priority: "1.0" },
  { loc: `${ORIGIN}/privacy`, priority: "0.3" },
  { loc: `${ORIGIN}/terms`, priority: "0.3" },
];
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`,
);

console.log(`Landing page written to ${DIST}/ (index.html; app shell now app.html; og.png, robots.txt, sitemap.xml)`);
