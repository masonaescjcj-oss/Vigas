/**
 * frontend/src/services/bundlePreview.ts
 * ---------------------------------------------------------------------------
 * A small deterministic bundler for the on-device preview.
 *
 * The preview used to inline plain <script src> tags only, so anything modular
 * — `import "./cart.js"`, a JSX component, a TypeScript file — silently failed.
 * This turns a project's files into one self-contained script:
 *
 *   1. transform each module with sucrase (JSX/TS -> JS, ESM -> CommonJS)
 *   2. resolve relative imports between project files
 *   3. emit a tiny CommonJS registry so the modules run in the right order
 *
 * Bare imports (react, react-dom/client, …) are left to an import map the
 * preview document supplies, because vendoring libraries into the app bundle
 * is not something a mobile app should do.
 *
 * Pure string-in/string-out, so it is unit-tested without a browser.
 * ---------------------------------------------------------------------------
 */

import { transform } from "sucrase";

/** Extensions we can compile, in the order used to resolve extensionless imports. */
const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

const COMPILABLE = /\.(jsx?|tsx?|mjs)$/i;

export interface BundleResult {
  /** Executable JS for a classic <script> tag, or null when there is no entry. */
  code: string | null;
  /** Entry module that was bundled. */
  entry: string | null;
  /** Bare module specifiers the code expects (react, etc.). */
  externals: string[];
  /** Non-fatal problems worth showing the user (missing import, compile error). */
  warnings: string[];
}

/** Normalize "a/./b/../c" -> "a/c" and strip a leading "./". */
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

/** Resolve an import specifier relative to the importing file. */
export function resolveSpecifier(
  specifier: string,
  fromFile: string,
  files: Record<string, string>,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null; // bare -> external
  const base = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const joined = specifier.startsWith("/")
    ? normalizePath(specifier)
    : normalizePath(`${base}/${specifier}`);
  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = normalizePath(joined + extension);
    if (files[candidate] !== undefined) return candidate;
  }
  return null;
}

/** Pick the entry module for a project that has no HTML of its own. */
export function findEntry(files: Record<string, string>): string | null {
  const candidates = [
    "index.tsx", "index.jsx", "index.ts", "index.js",
    "src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js",
    "main.tsx", "main.jsx", "main.ts", "main.js",
    "src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js",
    "App.tsx", "App.jsx", "src/App.tsx", "src/App.jsx",
    "app.js", "src/app.js",
  ];
  for (const candidate of candidates) {
    if (files[candidate] !== undefined) return candidate;
  }
  return null;
}

function compile(path: string, source: string): { code: string; error?: string } {
  try {
    const isTs = /\.tsx?$/i.test(path);
    const isJsx = /\.(jsx|tsx)$/i.test(path);
    const transforms: Array<"jsx" | "typescript" | "imports"> = ["imports"];
    if (isTs) transforms.push("typescript");
    if (isJsx) transforms.push("jsx");
    return {
      code: transform(source, {
        transforms,
        filePath: path,
        production: true,
        // The automatic runtime, because modern React and React Native code does
        // not import React at all — `import { useState } from "react"` is the
        // normal shape, and Expo's own template is written that way. The classic
        // runtime emits bare `React.createElement` calls, which in a file with no
        // default import is a free variable and a ReferenceError the moment the
        // component renders. Automatic emits an import of the jsx factory
        // instead, which the bundler then resolves like any other dependency.
        jsxRuntime: "automatic",
      }).code,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Surface the failure inside the preview instead of rendering a blank page.
    return {
      code: `throw new Error(${JSON.stringify(`Could not compile ${path}: ${message}`)});`,
      error: `${path}: ${message}`,
    };
  }
}

/**
 * Bundle `entry` and everything it imports into a single CommonJS-style script.
 */
export function bundleModules(files: Record<string, string>, entry: string): BundleResult {
  if (files[entry] === undefined) {
    return { code: null, entry: null, externals: [], warnings: [`Entry file ${entry} not found`] };
  }

  const modules = new Map<string, string>();
  const externals = new Set<string>();
  const warnings: string[] = [];
  const queue = [normalizePath(entry)];
  const seen = new Set<string>();

  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);

    const source = files[path];
    if (source === undefined) continue;

    const { code, error } = COMPILABLE.test(path)
      ? compile(path, source)
      : { code: `module.exports = ${JSON.stringify(source)};`, error: undefined };
    if (error) warnings.push(error);

    // Collect this module's dependencies from the CommonJS output sucrase emits.
    for (const match of code.matchAll(/require\(\s*(['"])(.*?)\1\s*\)/g)) {
      const specifier = match[2];
      const resolved = resolveSpecifier(specifier, path, files);
      if (resolved) queue.push(resolved);
      else if (!specifier.startsWith(".") && !specifier.startsWith("/")) externals.add(specifier);
      else warnings.push(`${path}: cannot find "${specifier}"`);
    }

    modules.set(path, code);
  }

  const registry = [...modules.entries()]
    .map(([path, code]) => `  ${JSON.stringify(path)}: function (module, exports, require) {\n${code}\n  }`)
    .join(",\n");

  const runtime = `(function () {
  var __defs = {
${registry}
  };
  var __cache = {};
  var __external = (typeof window !== "undefined" && window.__previewExternals) || {};
  function __norm(p) {
    var out = [];
    p.split("/").forEach(function (s) {
      if (!s || s === ".") return;
      if (s === "..") out.pop(); else out.push(s);
    });
    return out.join("/");
  }
  function __resolve(spec, from) {
    if (spec[0] !== "." && spec[0] !== "/") return null;
    var base = from.indexOf("/") >= 0 ? from.slice(0, from.lastIndexOf("/")) : "";
    var joined = spec[0] === "/" ? __norm(spec) : __norm(base + "/" + spec);
    var exts = ${JSON.stringify(RESOLVE_EXTENSIONS)};
    for (var i = 0; i < exts.length; i++) {
      var candidate = __norm(joined + exts[i]);
      if (__defs[candidate]) return candidate;
    }
    return null;
  }
  function __require(spec, from) {
    // A specifier can be an exact module id (the entry, or an already-resolved
    // path) as well as something relative to the importing file.
    var path = __defs[spec] ? spec : __resolve(spec, from || "");
    if (!path) {
      if (__external[spec]) return __external[spec];
      throw new Error('Module "' + spec + '" is not available in this preview.');
    }
    if (__cache[path]) return __cache[path].exports;
    var module = { exports: {} };
    __cache[path] = module;
    __defs[path](module, module.exports, function (s) { return __require(s, path); });
    return module.exports;
  }
  try {
    // Kept, not discarded: a React Native entry only \`export default App\` — the
    // mounting is Expo's job, and there is no Expo here. The shell reads this to
    // render that component itself. A web entry that mounts on its own leaves
    // #root non-empty, so the shell skips it and this is simply unused.
    window.__previewEntryExports = __require(${JSON.stringify(normalizePath(entry))}, "");
  } catch (error) {
    var box = document.createElement("pre");
    box.style.cssText = "white-space:pre-wrap;color:#f87171;background:#2a1214;padding:16px;border-radius:12px;font:13px ui-monospace,monospace;margin:16px";
    box.textContent = String((error && error.stack) || error);
    document.body.appendChild(box);
  }
})();`;

  return { code: runtime, entry: normalizePath(entry), externals: [...externals], warnings };
}
