/**
 * The bundler decides whether a modular or React project previews at all, so
 * its resolution rules and failure behaviour need real coverage.
 */
import { describe, expect, it } from "vitest";
import { bundleModules, findEntry, normalizePath, resolveSpecifier } from "../bundlePreview";

describe("normalizePath", () => {
  it("collapses . and .. segments", () => {
    expect(normalizePath("src/./components/../App.jsx")).toBe("src/App.jsx");
    expect(normalizePath("./index.js")).toBe("index.js");
  });
});

describe("resolveSpecifier", () => {
  const files = {
    "index.jsx": "",
    "src/App.jsx": "",
    "src/util/format.ts": "",
    "src/util/index.ts": "",
  };

  it("resolves a sibling import", () => {
    expect(resolveSpecifier("./App.jsx", "index.jsx", { ...files, "App.jsx": "" })).toBe("App.jsx");
  });

  it("adds a missing extension", () => {
    expect(resolveSpecifier("./util/format", "src/App.jsx", files)).toBe("src/util/format.ts");
  });

  it("resolves a directory to its index file", () => {
    expect(resolveSpecifier("./util", "src/App.jsx", files)).toBe("src/util/index.ts");
  });

  it("walks up with ..", () => {
    expect(resolveSpecifier("../App.jsx", "src/util/format.ts", files)).toBe("src/App.jsx");
  });

  it("treats bare specifiers as external", () => {
    expect(resolveSpecifier("react", "index.jsx", files)).toBeNull();
  });

  it("returns null for a file that does not exist", () => {
    expect(resolveSpecifier("./nope.js", "index.jsx", files)).toBeNull();
  });
});

describe("findEntry", () => {
  it("prefers index over other candidates", () => {
    expect(findEntry({ "index.jsx": "", "src/App.jsx": "" })).toBe("index.jsx");
  });

  it("falls back to src/main and App", () => {
    expect(findEntry({ "src/main.tsx": "" })).toBe("src/main.tsx");
    expect(findEntry({ "src/App.jsx": "" })).toBe("src/App.jsx");
  });

  it("returns null when there is nothing to run", () => {
    expect(findEntry({ "styles.css": "", "readme.md": "" })).toBeNull();
  });
});

describe("bundleModules", () => {
  it("compiles JSX into plain JS", () => {
    const result = bundleModules({ "index.jsx": "const el = <h1>hello</h1>;" }, "index.jsx");
    expect(result.code).toContain("createElement");
    expect(result.code).not.toContain("<h1>");
    expect(result.warnings).toEqual([]);
  });

  it("strips TypeScript types", () => {
    const result = bundleModules(
      { "index.ts": "const n: number = 1; export type Foo = string; console.log(n);" },
      "index.ts",
    );
    expect(result.code).toContain("const n = 1");
    expect(result.code).not.toContain(": number");
  });

  it("includes imported modules in the bundle", () => {
    const result = bundleModules(
      {
        "index.js": 'import { greet } from "./greet.js"; greet();',
        "greet.js": 'export function greet() { return "hi"; }',
      },
      "index.js",
    );
    expect(result.code).toContain('"greet.js"');
    expect(result.code).toContain("function greet");
  });

  it("follows a transitive import chain", () => {
    const result = bundleModules(
      {
        "index.js": 'import "./a.js";',
        "a.js": 'import "./nested/b.js";',
        "nested/b.js": "console.log('deep');",
      },
      "index.js",
    );
    expect(result.code).toContain('"nested/b.js"');
  });

  it("does not loop forever on a circular import", () => {
    const result = bundleModules(
      { "a.js": 'import "./b.js";', "b.js": 'import "./a.js";' },
      "a.js",
    );
    expect(result.code).toContain('"b.js"');
  });

  it("reports bare imports as externals rather than failing", () => {
    const result = bundleModules(
      { "index.jsx": 'import React from "react"; import { createRoot } from "react-dom/client";' },
      "index.jsx",
    );
    expect(result.externals).toContain("react");
    expect(result.externals).toContain("react-dom/client");
  });

  it("warns about an import that does not exist", () => {
    const result = bundleModules({ "index.js": 'import "./missing.js";' }, "index.js");
    expect(result.warnings.join(" ")).toContain("missing.js");
  });

  it("turns a syntax error into a visible runtime error, not a blank page", () => {
    const result = bundleModules({ "index.jsx": "const broken = <div>;" }, "index.jsx");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.code).toContain("Could not compile");
  });

  it("reports a missing entry instead of throwing", () => {
    const result = bundleModules({ "a.js": "" }, "index.js");
    expect(result.code).toBeNull();
    expect(result.warnings.join(" ")).toContain("not found");
  });

  it("inlines a non-code import (json) as a string module", () => {
    const result = bundleModules(
      { "index.js": 'import data from "./data.json"; console.log(data);', "data.json": '{"a":1}' },
      "index.js",
    );
    expect(result.code).toContain('"data.json"');
  });
});

/**
 * String assertions cannot tell whether the generated bundle actually runs —
 * an earlier version produced perfectly plausible code that threw
 * 'Module "src/index.jsx" is not available' the moment it executed. These
 * tests execute the bundle.
 */
describe("bundleModules — the emitted code really runs", () => {
  const run = (files: Record<string, string>, entry: string, externals: Record<string, unknown> = {}) => {
    const { code } = bundleModules(files, entry);
    const appended: string[] = [];
    const doc = {
      createElement: () => ({ style: { cssText: "" }, textContent: "" }),
      body: { appendChild: (n: { textContent: string }) => appended.push(n.textContent) },
    };
    const win = { __previewExternals: externals };
    const result: Record<string, unknown> = {};
    // eslint-disable-next-line no-new-func
    new Function("window", "document", "__out", code!)(win, doc, result);
    return { appended, result, win };
  };

  it("executes the entry module", () => {
    const { result } = run({ "index.js": "__out.ran = true;" }, "index.js");
    expect(result.ran).toBe(true);
  });

  it("executes an entry in a subdirectory (the id is not relative)", () => {
    const { result } = run({ "src/index.jsx": "__out.ran = true;" }, "src/index.jsx");
    expect(result.ran).toBe(true);
  });

  it("runs imported modules and passes values across the graph", () => {
    const { result } = run(
      {
        "src/index.js": 'import { twice } from "./util/math.js"; __out.value = twice(21);',
        "src/util/math.js": "export function twice(n) { return n * 2; }",
      },
      "src/index.js",
    );
    expect(result.value).toBe(42);
  });

  it("evaluates each module once even when imported twice", () => {
    const { result } = run(
      {
        "index.js": 'import "./a.js"; import "./b.js"; __out.count = window.hits;',
        "a.js": 'import "./shared.js";',
        "b.js": 'import "./shared.js";',
        "shared.js": "window.hits = (window.hits || 0) + 1;",
      },
      "index.js",
    );
    expect(result.count).toBe(1);
  });

  it("hands bare imports to the externals provided by the page", () => {
    const { result } = run(
      { "index.js": 'import React from "react"; __out.name = React.marker;' },
      "index.js",
      { react: { default: { marker: "react-stub" }, marker: "react-stub" } },
    );
    expect(result.name).toBe("react-stub");
  });

  it("renders a runtime error into the page instead of failing silently", () => {
    const { appended } = run({ "index.js": 'throw new Error("boom");' }, "index.js");
    expect(appended.join(" ")).toContain("boom");
  });
});
