/**
 * frontend/src/services/previewBuilder.ts
 * ---------------------------------------------------------------------------
 * Turns a map of project text files into one self-contained HTML document for
 * the on-device preview. Local <link>/<script> references are inlined, so the
 * whole app renders inside a sandboxed iframe/WebView with zero server cost.
 *
 * JSX/TypeScript and multi-file ES modules are compiled and bundled first
 * (see bundlePreview.ts); plain HTML/CSS/JS projects are inlined as-is and
 * never touch the network.
 * ---------------------------------------------------------------------------
 */

import { bundleModules, findEntry, resolveSpecifier } from "./bundlePreview";

function normalizeRef(ref: string): string {
  return ref.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * CDN used only when a project imports a library (react, …). Plain HTML/CSS/JS
 * projects — every starter template — never touch the network.
 */
const ESM_CDN = "https://esm.sh";

/**
 * Bare specifiers that resolve to a different package, or a pinned one.
 *
 * `react-native` is the one that matters: a React Native app imports its
 * primitives from there, and on the web those come from react-native-web. This
 * is exactly what Expo's own web target does, so an Expo project previews here
 * with no bundler, no Metro and no device — measured in the running app, a real
 * View/Text/Pressable tree renders, StyleSheet styles apply, and state updates
 * on press.
 *
 * Versions are pinned because an unpinned major on the CDN would change what a
 * preview does without anything in this repository changing. react and
 * react-dom are pinned to the same 18.x react-native-web expects, which is also
 * what keeps a second copy of React out of the page — RNW's own hooks
 * (useWindowDimensions, Animated) were checked against it.
 */
const IMPORT_ALIASES: Record<string, string> = {
  "react-native": "react-native-web@0.19.13",
  react: "react@18.3.1",
  "react-dom": "react-dom@18.3.1",
  "react-dom/client": "react-dom@18.3.1/client",
  // Emitted by the compiler, never written by hand: with the automatic JSX
  // runtime every file containing JSX imports its factory from here.
  "react/jsx-runtime": "react@18.3.1/jsx-runtime",
};

function cdnUrlFor(specifier: string): string {
  return `${ESM_CDN}/${IMPORT_ALIASES[specifier] ?? specifier}`;
}

/** Import map + shim so bundled code can `require("react")` etc. */
function externalsLoader(externals: string[]): string {
  if (externals.length === 0) return "";
  const entries = externals.map((name) => `[${JSON.stringify(name)}, ${JSON.stringify(cdnUrlFor(name))}]`);
  return `<script type="module">
  window.__previewExternals = window.__previewExternals || {};
  const wanted = [${entries.join(", ")}];
  try {
    await Promise.all(wanted.map(async ([name, url]) => {
      window.__previewExternals[name] = await import(/* @vite-ignore */ url);
    }));
  } catch (error) {
    document.body.insertAdjacentHTML("afterbegin",
      '<pre style="white-space:pre-wrap;color:#fbbf24;background:#2a2412;padding:16px;border-radius:12px;font:13px ui-monospace,monospace;margin:16px">' +
      'This preview needs ' + wanted.map(w => w[0]).join(", ") + ', which could not be loaded.\\n' +
      'Libraries are fetched on demand, so this part of the preview needs a connection.' +
      '</pre>');
  }
  window.dispatchEvent(new Event("preview-externals-ready"));
</script>`;
}

/** Inline local stylesheet and script references into the HTML document. */
function inlineLocalAssets(html: string, files: Record<string, string>): string {
  let out = html.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href) => {
      const key = normalizeRef(String(href));
      if (!/\brel=["']?stylesheet/i.test(match) && !key.endsWith(".css")) return match;
      const css = files[key];
      return css !== undefined ? `<style>\n${css}\n</style>` : match;
    },
  );
  out = out.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src) => {
      const key = normalizeRef(String(src));
      const resolved = files[key] !== undefined ? key : findModuleFile(key, files);
      // External (http/cdn) scripts stay untouched; local ones get inlined.
      if (!resolved) return match;
      // Modular or JSX/TS sources have to be bundled, not pasted in raw.
      if (needsBundling(resolved, files[resolved])) {
        const bundle = bundleModules(files, resolved);
        return renderBundle(bundle);
      }
      return `<script>\n${files[resolved]}\n</script>`;
    },
  );
  return out;
}

/** A <script src="./app"> may omit the extension the file actually has. */
function findModuleFile(key: string, files: Record<string, string>): string | null {
  return resolveSpecifier(`./${key}`, "index.html", files);
}

function needsBundling(path: string, source: string): boolean {
  if (/\.(jsx|tsx|ts|mjs)$/i.test(path)) return true;
  // Plain .js is only bundled when it actually uses modules.
  return /^\s*import\s|^\s*export\s/m.test(source);
}

/**
 * Fetching react from a CDN takes a few seconds on a cold cache, and until the
 * bundle runs the page is empty. Without this the preview just looks broken.
 */
function loadingSplash(externals: string[]): string {
  const names = escapeHtml(externals.join(", "));
  return `<div id="__preview-loading" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:#0f1115;color:#9ca3af;font:13px system-ui,sans-serif">
<div style="width:22px;height:22px;border:2px solid #27272a;border-top-color:#8B5CF6;border-radius:50%;animation:__spin .8s linear infinite"></div>
<div>Loading ${names}…</div>
<style>@keyframes __spin{to{transform:rotate(360deg)}}</style>
</div>`;
}

/**
 * Render the entry's default export when nothing has rendered itself.
 *
 * A React Native entry is just `export default function App()` — mounting is
 * the framework's job, and the preview is not the framework. A plain React
 * entry usually calls createRoot itself; that leaves #root populated, so this
 * sees it and does nothing. Anything else already showed an error box.
 *
 * Deferred by a tick, so an entry that mounts asynchronously is not mounted
 * twice. The tick is a `setTimeout` and not a `requestAnimationFrame`: a
 * preview in a backgrounded tab or an inactive pane is served no frames at all,
 * and anything waiting on one would never mount there. A timer still fires.
 */
const AUTO_MOUNT = `
(function () {
  setTimeout(function () {
    var root = document.getElementById("root");
    if (!root || root.childNodes.length > 0) return;
    var entry = window.__previewEntryExports;
    var App = entry && (entry.default || (typeof entry === "function" ? entry : null));
    if (typeof App !== "function") return;
    var React = window.__previewExternals && window.__previewExternals["react"];
    var client = window.__previewExternals && window.__previewExternals["react-dom/client"];
    if (!React || !client) return;
    var create = client.createRoot || (client.default && client.default.createRoot);
    if (!create) return;
    try {
      create(root).render(React.createElement(App));
    } catch (error) {
      var box = document.createElement("pre");
      box.style.cssText = "white-space:pre-wrap;color:#f87171;background:#2a1214;padding:16px;border-radius:12px;font:13px ui-monospace,monospace;margin:16px";
      box.textContent = String((error && error.stack) || error);
      document.body.appendChild(box);
    }
  }, 0);
})();
`;

function renderBundle(bundle: ReturnType<typeof bundleModules>): string {
  if (!bundle.code) return `<script>console.error(${JSON.stringify(bundle.warnings.join("; "))})</script>`;

  // A React Native entry imports react and react-native, never react-dom — its
  // renderer is supposed to be the framework's. Since the shell has to mount it
  // here, the renderer is fetched whether the project asked for it or not.
  const needed = [...bundle.externals];
  const isReactish = needed.includes("react") || needed.includes("react-native");
  if (isReactish && !needed.includes("react-dom/client")) needed.push("react-dom/client");
  if (needed.includes("react-native") && !needed.includes("react")) needed.push("react");

  const externals = externalsLoader(needed);
  const run = `<script>\n${bundle.code}\n</script>`;
  if (!externals) return run;
  // With externals we must wait for the dynamic imports to resolve first, and
  // show something in the meantime. The splash names what the *project* asked
  // for, not what was added on its behalf.
  return `${loadingSplash(bundle.externals)}
${externals}
<script>window.addEventListener("preview-externals-ready", function () {
  var splash = document.getElementById("__preview-loading");
  if (splash) splash.remove();
${bundle.code}
${isReactish ? AUTO_MOUNT : ""}
});</script>`;
}

/** Fallback page when the project has no index.html yet. */
function fallbackDocument(files: Record<string, string>): string {
  const names = Object.keys(files).sort();
  const readme = files["readme.md"] ?? files["README.md"];
  const list = names.length
    ? names.map((n) => `<li><code>${escapeHtml(n)}</code></li>`).join("")
    : "<li class='muted'>No files yet — ask the agent to build something!</li>";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;background:#0f1115;color:#f4f4f5;padding:32px;line-height:1.6}
h1{font-size:20px} code{background:#181b22;padding:2px 8px;border-radius:6px}
ul{list-style:none;padding:0} li{margin:8px 0} .muted{color:#9ca3af}
pre{background:#181b22;border-radius:12px;padding:16px;white-space:pre-wrap;margin-top:24px}
</style></head><body>
<h1>Project files</h1>
<p class="muted">This project has no <code>index.html</code> yet. Ask the agent to create a web page and it will show up here.</p>
<ul>${list}</ul>
${readme ? `<pre>${escapeHtml(readme)}</pre>` : ""}
</body></html>`;
}

/**
 * A project that ships components but no HTML (the shape an agent produces when
 * asked for "a React app") gets a generated shell so it still renders, instead
 * of falling through to a file listing.
 */
function appShell(files: Record<string, string>, entry: string): string {
  const bundle = bundleModules(files, entry);
  const css = Object.entries(files)
    .filter(([path]) => path.endsWith(".css"))
    .map(([, contents]) => contents)
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:dark light}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#0f1115;color:#f4f4f5}
#root{min-height:100vh}
</style>
${css ? `<style>\n${css}\n</style>` : ""}
</head><body>
<div id="root"></div>
<div id="app"></div>
${renderBundle(bundle)}
</body></html>`;
}

export function buildPreviewHtml(files: Record<string, string>): string {
  const html = files["index.html"] ?? files["index.htm"] ?? files["public/index.html"];
  if (html) return inlineLocalAssets(html, files);

  const entry = findEntry(files);
  if (entry) return appShell(files, entry);

  return fallbackDocument(files);
}
