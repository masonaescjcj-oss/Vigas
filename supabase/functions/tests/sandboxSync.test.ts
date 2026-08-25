import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSandboxOnly, planSandboxSync } from "../shared/storage.ts";

Deno.test("an empty sandbox listing never empties the project", () => {
  // The data-loss path. listFiles returns [] for a directory that does not
  // exist — a reclaimed sandbox, a command killed part-way, a work directory
  // that never got created. The sync mirrors the sandbox, so [] read as truth
  // means "the user deleted everything", and the files *are* the product.
  const plan = planSandboxSync({
    sandboxFiles: [],
    storageFiles: ["index.html", "styles.css", "src/app.js"],
  });

  assertEquals(plan.remove, []);
  assertEquals(plan.upload, []);
  assertEquals(typeof plan.abort, "string");
});

Deno.test("a genuinely empty project is not an error", () => {
  // Nothing on either side is just a new project; there is nothing to lose.
  const plan = planSandboxSync({ sandboxFiles: [], storageFiles: [] });
  assertEquals(plan.abort, undefined);
  assertEquals(plan.upload, []);
  assertEquals(plan.remove, []);
});

Deno.test("a file the agent deleted is still removed", () => {
  // The deletion path has to keep working, or `rm` in the sandbox would never
  // reach the project.
  const plan = planSandboxSync({
    sandboxFiles: ["index.html"],
    storageFiles: ["index.html", "old.html"],
  });
  assertEquals(plan.abort, undefined);
  assertEquals(plan.remove, ["old.html"]);
  assertEquals(plan.upload, ["index.html"]);
});

Deno.test("npm install does not put node_modules in the user's project", () => {
  // One install is tens of thousands of files, each its own upload request.
  const plan = planSandboxSync({
    sandboxFiles: [
      "index.html",
      "package.json",
      "node_modules/react/index.js",
      "node_modules/.bin/tsc",
      ".git/objects/ab/cdef",
      "dist/bundle.js",
      "npm-debug.log",
    ],
    storageFiles: ["index.html", "package.json"],
  });

  assertEquals(plan.upload, ["index.html", "package.json"]);
  assertEquals(plan.remove, []);
  assertEquals(plan.skipped, 5);
});

Deno.test("skipped paths are left alone, not deleted", () => {
  // A project written before the sync learned to skip these still has them.
  // They must not be uploaded, and they are not ours to delete either —
  // deleting on absence is exactly the rule that makes this dangerous.
  const plan = planSandboxSync({
    sandboxFiles: ["index.html"],
    storageFiles: ["index.html", "node_modules/react/index.js"],
  });
  assertEquals(plan.remove, []);
});

Deno.test("a listing that got away from us aborts rather than uploading", () => {
  const plan = planSandboxSync({
    sandboxFiles: Array.from({ length: 2_001 }, (_, i) => `generated/file${i}.txt`),
    storageFiles: ["index.html"],
  });
  assertEquals(plan.upload, []);
  assertEquals(plan.remove, []);
  assertEquals(typeof plan.abort, "string");
});

Deno.test("nested sandbox directories are recognised too", () => {
  assertEquals(isSandboxOnly("node_modules/react/index.js"), true);
  assertEquals(isSandboxOnly("packages/web/node_modules/react/index.js"), true);
  assertEquals(isSandboxOnly(".git/HEAD"), true);
  assertEquals(isSandboxOnly("src/dist/bundle.js"), true);
  // Real project files that merely look similar.
  assertEquals(isSandboxOnly("src/distance.ts"), false);
  assertEquals(isSandboxOnly("buildings.json"), false);
  assertEquals(isSandboxOnly("index.html"), false);
});
