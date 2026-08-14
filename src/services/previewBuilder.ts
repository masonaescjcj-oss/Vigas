/**
 * frontend/src/services/previewBuilder.ts
 * ---------------------------------------------------------------------------
 * Turns a map of project text files into one self-contained HTML document for
 * the on-device preview. Local <link>/<script> references are inlined, so the
 * whole app renders inside a sandboxed iframe/WebView with zero server cost.
 * ---------------------------------------------------------------------------
 */

function normalizeRef(ref: string): string {
  return ref.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      const js = files[key];
      // External (http/cdn) scripts stay untouched; local ones get inlined.
      return js !== undefined ? `<script>\n${js}\n</script>` : match;
    },
  );
  return out;
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
<h1>📁 Project files</h1>
<p class="muted">This project has no <code>index.html</code> yet. Ask the agent to create a web page and it will show up here.</p>
<ul>${list}</ul>
${readme ? `<pre>${escapeHtml(readme)}</pre>` : ""}
</body></html>`;
}

export function buildPreviewHtml(files: Record<string, string>): string {
  const entry = files["index.html"] ?? files["index.htm"] ?? files["public/index.html"];
  if (!entry) return fallbackDocument(files);
  return inlineLocalAssets(entry, files);
}
