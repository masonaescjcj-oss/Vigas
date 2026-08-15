/**
 * The tree shape decides whether a nested file is reachable at all, so the
 * grouping and ordering rules get their own coverage.
 */
import { describe, expect, it } from "vitest";
import { buildFileTree } from "../fileTree";

describe("buildFileTree", () => {
  it("keeps top-level files flat", () => {
    const tree = buildFileTree(["index.html", "styles.css"]);
    expect(tree.map((n) => n.name)).toEqual(["index.html", "styles.css"]);
    expect(tree.every((n) => !n.isDir)).toBe(true);
  });

  it("creates a folder for a nested path", () => {
    const tree = buildFileTree(["src/app.js"]);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: "src", path: "src", isDir: true });
    expect(tree[0].children).toMatchObject([{ name: "app.js", path: "src/app.js", isDir: false }]);
  });

  it("groups siblings under one folder rather than repeating it", () => {
    const tree = buildFileTree(["src/a.js", "src/b.js"]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children?.map((n) => n.name)).toEqual(["a.js", "b.js"]);
  });

  it("nests arbitrarily deep", () => {
    const tree = buildFileTree(["src/components/ui/Button.tsx"]);
    // src → components → ui → Button.tsx
    const button = tree[0].children![0].children![0].children![0];
    expect(button).toMatchObject({ name: "Button.tsx", path: "src/components/ui/Button.tsx", isDir: false });
  });

  it("puts folders before files and sorts each group by name", () => {
    const tree = buildFileTree(["z.txt", "a.txt", "src/x.js", "assets/y.png"]);
    expect(tree.map((n) => n.name)).toEqual(["assets", "src", "a.txt", "z.txt"]);
  });

  it("sorts nested levels too, not just the root", () => {
    const tree = buildFileTree(["src/z.js", "src/a.js", "src/deep/q.js"]);
    expect(tree[0].children?.map((n) => n.name)).toEqual(["deep", "a.js", "z.js"]);
  });

  it("does not confuse a file and a folder that share a name", () => {
    const tree = buildFileTree(["config", "config/local.json"]);
    expect(tree.map((n) => [n.name, n.isDir])).toEqual([["config", true], ["config", false]]);
  });

  it("returns nothing for an empty project", () => {
    expect(buildFileTree([])).toEqual([]);
  });
});
