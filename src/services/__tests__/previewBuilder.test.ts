/**
 * The preview builder is the core of the product's headline feature: it turns
 * the agent's files into the page the user sees on their device. If it breaks,
 * the app silently shows a blank or broken preview, so it needs real coverage.
 */
import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "../previewBuilder";
import { PROJECT_TEMPLATES } from "../../../supabase/functions/shared/templates";

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

/**
 * A CDN fetch takes seconds on a cold cache; an empty page in the meantime
 * reads as a broken preview.
 */
describe("loading state for CDN-backed previews", () => {
  it("shows a splash while libraries load, and removes it before running", () => {
    const html = buildPreviewHtml({
      "index.jsx": 'import React from "react"; console.log(React);',
    });
    expect(html).toContain('id="__preview-loading"');
    expect(html).toContain("Loading react…");
    expect(html).toContain('document.getElementById("__preview-loading")');
  });

  it("does not add a splash to an offline project", () => {
    const html = buildPreviewHtml({
      "index.html": "<html><body><script src='app.js'></script></body></html>",
      "app.js": "console.log('hi');",
    });
    expect(html).not.toContain("__preview-loading");
  });
});

/**
 * React Native in the preview.
 *
 * The product exists to build apps that ship to the stores, which means the
 * output is a React Native project — and a browser cannot run one. What it can
 * run is react-native-web, the same substitution Expo's own web target makes,
 * so the preview needs no Metro, no device and no build.
 *
 * The template itself is the fixture: a test against a hand-written App.tsx
 * would keep passing after the real starter drifted away from it.
 */
describe("previewing a React Native project", () => {
  const expoApp = PROJECT_TEMPLATES.expo.files;

  it("resolves react-native to react-native-web on the CDN", () => {
    const html = buildPreviewHtml(expoApp);
    // The specifier the code imports stays "react-native" — that is the key the
    // module registry looks up — while the URL points at the web implementation.
    expect(html).toContain('["react-native", "https://esm.sh/react-native-web@');
  });

  it("pins the versions it loads", () => {
    // An unpinned major on the CDN would change what a preview does without
    // anything in this repository changing.
    const html = buildPreviewHtml(expoApp);
    expect(html).toMatch(/react-native-web@\d+\.\d+\.\d+/);
    expect(html).toMatch(/esm\.sh\/react@18\./);
  });

  it("fetches the renderer the project never imports", () => {
    // App.tsx imports react and react-native, never react-dom: mounting is
    // supposed to be the framework's job. Here it is the shell's.
    expect(expoApp["App.tsx"]).not.toContain("react-dom");
    const html = buildPreviewHtml(expoApp);
    expect(html).toContain("react-dom@18.3.1/client");
  });

  it("mounts the default export, because a React Native entry does not", () => {
    const html = buildPreviewHtml(expoApp);
    expect(expoApp["App.tsx"]).toContain("export default function App");
    expect(html).toContain("__previewEntryExports");
    expect(html).toContain("React.createElement(App)");
  });

  it("does not mount over an entry that mounted itself", () => {
    // A plain React project calls createRoot in its own entry. Mounting again
    // would produce two trees; the guard is that #root is already populated.
    const html = buildPreviewHtml(expoApp);
    expect(html).toContain("root.childNodes.length > 0");
  });

  it("waits with a timer rather than a frame", () => {
    // A preview in a backgrounded tab or an inactive pane gets no frames at
    // all, so anything gated on requestAnimationFrame never mounts there.
    const html = buildPreviewHtml(expoApp);
    const autoMount = html.slice(html.indexOf("__previewEntryExports") - 400);
    expect(autoMount).not.toContain("requestAnimationFrame");
  });

  it("leaves a plain HTML project alone", () => {
    // The static templates must not start pulling a renderer off the network.
    const html = buildPreviewHtml(PROJECT_TEMPLATES.todo.files);
    expect(html).not.toContain("react-native-web");
    expect(html).not.toContain("esm.sh");
  });
});

/**
 * The bug this guards against rendered a *perfect-looking* bundle and then
 * threw at runtime.
 *
 * Modern React and React Native code does not import React — `import { useState }
 * from "react"` is the normal shape and Expo's own template is written that way.
 * Compiled with the classic JSX runtime that becomes bare `React.createElement`
 * calls in a file with no `React` binding: a free variable, and a ReferenceError
 * the moment the component renders. Every structural assertion still passed.
 */
describe("JSX compiles against a runtime that is actually present", () => {
  const modernComponent = {
    "App.tsx": `import { useState } from "react";
import { Text, View } from "react-native";
export default function App() {
  const [n] = useState(0);
  return <View><Text>{n}</Text></View>;
}`,
  };

  it("never emits a React reference the file does not bind", () => {
    const html = buildPreviewHtml(modernComponent);
    const compiled = html.slice(html.indexOf('"App.tsx"'), html.indexOf("__cache"));
    expect(compiled).not.toContain("React.createElement");
  });

  it("imports the jsx factory instead, and can resolve it", () => {
    const html = buildPreviewHtml(modernComponent);
    // Emitted by the compiler, so it has to be in the alias table or the module
    // registry would throw "not available in this preview".
    expect(html).toContain("react/jsx-runtime");
    expect(html).toContain('["react/jsx-runtime", "https://esm.sh/react@18.3.1/jsx-runtime"]');
  });

  it("holds for the Expo starter too", () => {
    expect(PROJECT_TEMPLATES.expo.files["App.tsx"]).not.toContain("import React");
    const html = buildPreviewHtml(PROJECT_TEMPLATES.expo.files);
    const compiled = html.slice(html.indexOf('"App.tsx"'), html.indexOf("__cache"));
    expect(compiled).not.toContain("React.createElement");
  });
});
