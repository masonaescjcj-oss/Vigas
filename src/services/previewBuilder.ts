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

/** Import map + shim so bundled code can `require("react")` etc. */
function externalsLoader(externals: string[]): string {
  if (externals.length === 0) return "";
  const entries = externals.map((name) => `[${JSON.stringify(name)}, ${JSON.stringify(`${ESM_CDN}/${name}`)}]`);
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

function renderBundle(bundle: ReturnType<typeof bundleModules>): string {
  if (!bundle.code) return `<script>console.error(${JSON.stringify(bundle.warnings.join("; "))})</script>`;
  const externals = externalsLoader(bundle.externals);
  const run = `<script>\n${bundle.code}\n</script>`;
  // With externals we must wait for the dynamic imports to resolve first.
  return externals
    ? `${externals}\n<script>window.addEventListener("preview-externals-ready", function () {\n${bundle.code}\n});</script>`
    : run;
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
