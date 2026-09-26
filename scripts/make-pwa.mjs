/**
 * scripts/make-pwa.mjs
 * ---------------------------------------------------------------------------
 * Turn the Expo web export into an installable app.
 *
 * Run after `expo export --platform web`. It adds the three things a browser
 * needs before it will offer "Add to Home Screen" — a manifest, icons at real
 * sizes, and a service worker — and injects the tags into the exported HTML.
 *
 * A post-export step rather than a template override because this app does not
 * use Expo Router, so there is no `+html.tsx` to hook; fighting the exporter to
 * inject four tags would be more fragile than editing its output.
 *
 * The service worker is the part worth reading. It caches the app shell and
 * *nothing else*: an offline-capable shell is the point, and a cached API
 * response is a correctness bug waiting to happen — one user's data served to
 * the next person on the device, or a subscription that looks active for a day
 * after it lapsed.
 *
 *   node scripts/make-pwa.mjs [dist-dir]
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync, unlinkSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const DIST = process.argv[2] ?? "dist-web";

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`No ${DIST}/index.html — run \`expo export --platform web\` first.`);
  process.exit(1);
}

const APP_NAME = "Retro Code";
const SHORT_NAME = "Retro Code";
const THEME = "#171614";

/* ---- manifest ----------------------------------------------------------- */

const manifest = {
  name: APP_NAME,
  short_name: SHORT_NAME,
  description: "Build apps by describing them. The agent writes the code.",
  start_url: "/",
  // standalone, so an installed copy has no browser chrome and reads as an app.
  display: "standalone",
  background_color: THEME,
  theme_color: THEME,
  orientation: "portrait",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    // maskable is separate on purpose: Android crops any icon to its own shape,
    // and an icon without padding loses its edges to that crop.
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync(join(DIST, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

/* ---- package assets ------------------------------------------------------ */

// Metro exports anything required out of a package — the fonts, React
// Navigation's icons — under assets/node_modules/, and the Vercel CLI never
// uploads a directory by that name. Every font was a 404 on the live site
// while working locally. So the directory is renamed and the bundle's
// references follow it.
//
// A bundle whose bytes change here must change its name too: /_expo/static is
// served immutable for a year, so a browser that fetched the old bytes under
// the old name would keep asking for the old paths.
const bundleDir = join(DIST, "_expo", "static", "js", "web");
const PKG_FROM = "/assets/node_modules/";
const PKG_TO = "/assets/pkg/";
if (existsSync(join(DIST, "assets", "node_modules"))) {
  const from = join(DIST, "assets", "node_modules");
  const to = join(DIST, "assets", "pkg");
  try {
    renameSync(from, to);
  } catch (error) {
    // Windows refuses to rename a folder while anything holds a file in it,
    // and OneDrive holds freshly exported files while it syncs them. A copy
    // works regardless; the original left behind is never uploaded anyway.
    if (error.code !== "EPERM" && error.code !== "EBUSY") throw error;
    cpSync(from, to, { recursive: true });
    try { rmSync(from, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* see above */ }
  }
  const renamed = [];
  for (const file of readdirSync(bundleDir).filter((f) => f.endsWith(".js"))) {
    const source = readFileSync(join(bundleDir, file), "utf8");
    if (!source.includes(PKG_FROM)) continue;
    const rewritten = source.split(PKG_FROM).join(PKG_TO);
    const hash = createHash("md5").update(rewritten).digest("hex");
    const next = file.replace(/-[0-9a-f]{32}\.js$/, `-${hash}.js`);
    writeFileSync(join(bundleDir, next), rewritten);
    if (next !== file) unlinkSync(join(bundleDir, file));
    renamed.push([file, next]);
  }
  // Point whatever named a renamed bundle at its new name: the HTML's script
  // tag, and any chunk that loads another by file name.
  const referrers = [join(DIST, "index.html"), ...readdirSync(bundleDir).map((f) => join(bundleDir, f))];
  for (const path of referrers) {
    const text = readFileSync(path, "utf8");
    const updated = renamed.reduce((acc, [from, to]) => acc.split(from).join(to), text);
    if (updated !== text) writeFileSync(path, updated);
  }
  console.log(`Package assets moved to ${PKG_TO} (${renamed.length} bundle file(s) renamed)`);
}

/* ---- service worker ------------------------------------------------------ */

// Bumping this evicts the previous cache. Derived from the built bundle's
// filename, which Metro hashes from its contents — so a new build gets a new
// cache automatically and a rebuild that changed nothing does not.
const bundle = existsSync(bundleDir)
  ? readdirSync(bundleDir).find((f) => f.startsWith("AppEntry-"))
  : null;
const VERSION = bundle ? bundle.replace(/^AppEntry-|\.js$/g, "").slice(0, 12) : "dev";

const sw = `/*
 * Service worker for ${APP_NAME}. Generated by scripts/make-pwa.mjs.
 *
 * Caches the app shell so an installed copy opens without the network, and
 * deliberately caches nothing else. Anything cross-origin — Supabase above all
 * — goes straight to the network every time: a cached API response would mean
 * stale data at best, and one account's data shown to whoever opens the app
 * next at worst.
 */
const CACHE = "retro-code-${VERSION}";

self.addEventListener("install", (event) => {
  // The new worker takes over on the next load rather than waiting for every
  // tab to close, which for an installed app can be days.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only ever cache this app's own static GETs.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The HTML itself is network-first, so a deploy is picked up on the next
  // load instead of being pinned to whatever was cached at install.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/index.html"))),
    );
    return;
  }

  // Everything else here is content-hashed by Metro, so a cache hit can never
  // be stale: a changed file has a different name.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
`;
writeFileSync(join(DIST, "sw.js"), sw);

/* ---- html --------------------------------------------------------------- */

let html = readFileSync(join(DIST, "index.html"), "utf8");

if (!html.includes("manifest.webmanifest")) {
  const head = `
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="${THEME}">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="${SHORT_NAME}">
    <link rel="apple-touch-icon" href="/icons/icon-192.png">
    <script>
      // Registered after load so it never competes with the first paint.
      // Failure is not worth surfacing: the app works without it, it only
      // stops working offline.
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/sw.js").catch(function (error) {
            console.warn("[pwa] service worker not registered:", error);
          });
        });
      }
    </script>
  </head>`;
  html = html.replace("</head>", head);
  writeFileSync(join(DIST, "index.html"), html);
}

// From the environment if the caller exported it, otherwise from .env, which
// is where it lives for every other command in this project. Reading it here
// rather than demanding it means `node scripts/make-pwa.mjs` keeps working the
// way it always has.
function supabaseUrl() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) return process.env.EXPO_PUBLIC_SUPABASE_URL;
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("EXPO_PUBLIC_SUPABASE_URL="));
    return line ? line.slice("EXPO_PUBLIC_SUPABASE_URL=".length).trim() : null;
  } catch {
    return null;
  }
}

const SUPABASE_URL = supabaseUrl();

/* ---- host config --------------------------------------------------------- */

// Written into the output rather than the repo root, because the deployable
// thing is this directory: it is built here and uploaded as-is, so no source,
// no .env and no build step ever reach the host. A vercel.json at the root
// would describe a build that does not happen.
const vercel = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  rewrites: [
    // Ahead of the fallback, because the first match wins. shareUrl() builds
    // /share-page/<code>, so that is the path a link already carries — this
    // sends it to the proxy rather than to the app shell.
    ...(SUPABASE_URL
      ? [{ source: "/share-page/:code", destination: "/api/share?code=:code" }]
      : []),
    {
      // React Navigation writes real paths (/Onboarding, /AgentTab), but this
      // is one index.html. Without the fallback every refresh and every shared
      // link 404s — and an installed PWA reopens at its last path, so it 404s
      // on launch. Verified against these exact rules before trusting them:
      // deep paths serve HTML, and sw.js / the bundle still serve themselves.
      // Double backslashes: this is a JS string literal, so "\\." puts a real
      // \. in the emitted JSON. Written "\." it collapses to a bare dot, which
      // matches any character — harmless here, but not what it claims.
      //
      // privacy and terms are excluded because they are real static files, not
      // routes. Left in, the fallback served index.html and the router — which
      // has no such screen — dropped the visitor on onboarding. Google Play
      // requires a policy URL that opens the policy, so that was a blocker.
      source: "/((?!_expo/|assets/|icons/|fonts/|fonts\\.css|manifest\\.webmanifest|sw\\.js|favicon\\.ico|metadata\\.json|privacy|terms|api/|share-page/).*)",
      destination: "/index.html",
    },
  ],
  headers: [
    {
      // Metro content-hashes these filenames, so a changed file has a different
      // name and this can never serve something stale.
      source: "/_expo/static/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      // The opposite: these decide when everything else updates, so a cache
      // must never hold them.
      source: "/(sw\.js|index\.html|manifest\.webmanifest)",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
    },
    {
      // The app renders generated HTML in a sandboxed iframe, so it cannot deny
      // framing outright — but it can refuse to be framed by anyone else.
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    },
  ],
};
writeFileSync(join(DIST, "vercel.json"), JSON.stringify(vercel, null, 2));

// The store listing needs a privacy policy at a URL that opens the policy, and
// this is the step that already runs after every web export — so it happens
// here rather than in a second command somebody has to remember.
execFileSync(process.execPath, ["scripts/make-legal-pages.mjs", DIST], { stdio: "inherit" });

// The manifest above names /icons/*; without this step they were never
// written, and an install fell back to a screenshot of the page.
execFileSync(process.platform === "win32" ? "python" : "python3", ["scripts/make-icons.py", DIST], { stdio: "inherit" });

/* ---- share pages --------------------------------------------------------- */

// Supabase Edge Functions answer HTML with content-type: text/plain. Measured,
// not assumed — a real share returns 200 with a valid <!doctype html> body and
// that header, so a browser renders the markup as text and the visitor reads
// the page's source instead of the page.
//
// This host can send the right header, so share links come here and this
// forwards to the function. It is a proxy on purpose: the share content, its
// expiry and its revocation all stay in one place, and this only fixes what
// Supabase will not let that place say about itself.


// Skipped rather than fatal: the manifest, the service worker and the legal
// pages are what this script exists for, and a build should not die because an
// optional proxy has nowhere to point. Loud, though — a silent skip would mean
// share links stay broken with nobody the wiser.
if (!SUPABASE_URL) {
  console.warn(
    "! EXPO_PUBLIC_SUPABASE_URL not found — share proxy not generated.\n" +
      "  Share links will keep serving text/plain from Supabase and render as source.",
  );
} else {
  mkdirSync(join(DIST, "api"), { recursive: true });
writeFileSync(
  join(DIST, "api", "share.mjs"),
  `/*
 * Serves a share page with the content type Supabase will not send.
 * Generated by scripts/make-pwa.mjs — edit that, not this.
 */
const UPSTREAM = ${JSON.stringify(SUPABASE_URL.replace(/\/+$/, ""))};

export default async function handler(request, response) {
  const code = new URL(request.url, "http://localhost").searchParams.get("code") ?? "";

  // The code is the whole authorisation, so anything that is not one is a 404
  // rather than something to forward. Without this the path is an open proxy
  // to any function on the project.
  if (!/^[a-z0-9]{6,40}$/.test(code)) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.status(404).send("<!doctype html><title>Not found</title><p>That link is not valid.</p>");
  }

  try {
    const upstream = await fetch(\`\${UPSTREAM}/functions/v1/share-page/\${code}\`, {
      headers: { accept: "text/html" },
    });
    const body = await upstream.text();

    // The one thing this exists to do.
    response.setHeader("content-type", "text/html; charset=utf-8");
    // A share can be revoked, so it must not be cached for long anywhere.
    response.setHeader("cache-control", "public, max-age=60, must-revalidate");
    // Shared pages are user content: keep them out of this origin's context.
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");
    return response.status(upstream.status).send(body);
  } catch {
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.status(502).send("<!doctype html><title>Unavailable</title><p>This link could not be loaded. Try again shortly.</p>");
  }
}
`,
);
}

// An empty ignore file, and it has to exist.
//
// Expo writes fonts to assets/node_modules/@expo-google-fonts/..., and a host
// that falls back to the repo's .gitignore — which ignores node_modules —
// drops every font in the build. That failure is silent and easy to miss: the
// app still renders, in the system typeface, looking like a font that did not
// load rather than one that was never uploaded. Measured on the first deploy:
// all four families 404ed.
writeFileSync(
  join(DIST, ".vercelignore"),
  [
    "# Deliberately empty. This directory is build output: everything in it is",
    "# meant to ship, and nothing secret can reach it.",
    "#",
    "# It exists to stop the repository's .gitignore being used instead, which",
    "# ignores node_modules and would drop assets/node_modules/@expo-google-fonts",
    "# — every font in the build.",
    "",
  ].join("\n"),
);

console.log(`PWA files written to ${DIST}/ (cache ${VERSION})`);
console.log(`  manifest.webmanifest, sw.js, vercel.json, index.html tags`);
