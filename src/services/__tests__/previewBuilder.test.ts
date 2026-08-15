/**
 * The preview builder is the core of the product's headline feature: it turns
 * the agent's files into the page the user sees on their device. If it breaks,
 * the app silently shows a blank or broken preview, so it needs real coverage.
 */
import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "../previewBuilder";

describe("buildPreviewHtml", () => {
  it("inlines a local stylesheet so the preview needs no server", () => {
    const html = buildPreviewHtml({
      "index.html": `<html><head><link rel="stylesheet" href="styles.css"></head><body>hi</body></html>`,
      "styles.css": "body{color:red}",
    });
    expect(html).toContain("<style>");
    expect(html).toContain("body{color:red}");
    expect(html).not.toContain('href="styles.css"');
  });

  it("inlines a local script", () => {
    const html = buildPreviewHtml({
      "index.html": `<html><body><script src="app.js"></script></body></html>`,
      "app.js": "console.log('run')",
    });
    expect(html).toContain("console.log('run')");
    expect(html).not.toContain('src="app.js"');
  });

  it("resolves ./ and / prefixed references", () => {
    const html = buildPreviewHtml({
      "index.html": `<link rel="stylesheet" href="./styles.css"><script src="/app.js"></script>`,
      "styles.css": "a{}",
      "app.js": "b()",
    });
    expect(html).toContain("a{}");
    expect(html).toContain("b()");
  });

  it("ignores query strings and hashes when matching a file", () => {
    const html = buildPreviewHtml({
      "index.html": `<script src="app.js?v=2"></script>`,
      "app.js": "cacheBusted()",
    });
    expect(html).toContain("cacheBusted()");
  });

  it("leaves external CDN references alone", () => {
    const cdn = "https://cdn.example.com/lib.js";
    const html = buildPreviewHtml({ "index.html": `<script src="${cdn}"></script>` });
    expect(html).toContain(cdn);
  });

  it("falls back to a file listing when there is nothing runnable", () => {
    const html = buildPreviewHtml({ "notes.md": "# hello", "styles.css": "body{}" });
    expect(html).toContain("Project files");
    expect(html).toContain("notes.md");
  });

  it("shows the readme in the fallback page", () => {
    const html = buildPreviewHtml({ "readme.md": "My project readme" });
    expect(html).toContain("My project readme");
  });

  it("escapes HTML in the fallback so file contents cannot inject markup", () => {
    const html = buildPreviewHtml({ "readme.md": "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("handles an empty project without throwing", () => {
    const html = buildPreviewHtml({});
    expect(html).toContain("No files yet");
  });

  it("prefers index.html over other entry candidates", () => {
    const html = buildPreviewHtml({
      "index.html": "<p>root</p>",
      "public/index.html": "<p>public</p>",
    });
    expect(html).toContain("root");
    expect(html).not.toContain("public</p>");
  });
});

describe("buildPreviewHtml — modular and JSX projects", () => {
  it("bundles a JSX entry referenced from index.html", () => {
    const html = buildPreviewHtml({
      "index.html": `<div id="root"></div><script src="app.jsx"></script>`,
      "app.jsx": `const el = <h1>Hi</h1>; document.body.append(String(el));`,
    });
    expect(html).toContain("createElement");
    expect(html).not.toContain("<h1>Hi</h1>");
  });

  it("resolves a script tag that omits the file extension", () => {
    const html = buildPreviewHtml({
      "index.html": `<script src="app"></script>`,
      "app.jsx": `const x = <p>ok</p>;`,
    });
    expect(html).toContain("createElement");
  });

  it("bundles multi-file ES modules referenced from index.html", () => {
    const html = buildPreviewHtml({
      "index.html": `<script src="main.js"></script>`,
      "main.js": `import { hello } from "./lib.js"; hello();`,
      "lib.js": `export function hello() { document.title = "done"; }`,
    });
    expect(html).toContain("function hello");
    expect(html).toContain('"lib.js"');
  });

  it("leaves a plain non-module script inlined verbatim", () => {
    const html = buildPreviewHtml({
      "index.html": `<script src="app.js"></script>`,
      "app.js": `document.title = "plain";`,
    });
    expect(html).toContain('document.title = "plain";');
    expect(html).not.toContain("__require");
  });

  it("generates an app shell for a React project with no index.html", () => {
    const html = buildPreviewHtml({
      "src/App.jsx": `import React from "react";\nexport default function App(){ return <h1>App</h1>; }`,
    });
    expect(html).toContain('<div id="root">');
    expect(html).toContain("createElement");
  });

  it("loads bare imports from the CDN and defers the bundle until they resolve", () => {
    const html = buildPreviewHtml({
      "index.jsx": `import React from "react"; console.log(React);`,
    });
    expect(html).toContain("esm.sh/react");
    expect(html).toContain("preview-externals-ready");
  });

  it("keeps plain-HTML template projects completely offline", () => {
    const html = buildPreviewHtml({
      "index.html": `<link rel="stylesheet" href="styles.css"><script src="app.js"></script>`,
      "styles.css": "body{margin:0}",
      "app.js": "console.log(1)",
    });
    expect(html).not.toContain("esm.sh");
    expect(html).not.toContain("http");
  });

  it("includes project css in the generated shell", () => {
    const html = buildPreviewHtml({
      "index.jsx": `document.title = "x";`,
      "styles.css": "body{background:papayawhip}",
    });
    expect(html).toContain("papayawhip");
  });
});
