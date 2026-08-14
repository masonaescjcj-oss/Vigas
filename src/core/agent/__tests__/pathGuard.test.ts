import { describe, it, expect, beforeEach } from "vitest";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveAndValidatePath, isPathAllowed, PathGuardError } from "../sandbox/pathGuard.ts";

describe("pathGuard.resolveAndValidatePath", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "issac-guard-"));
  });

  it("allows a plain relative path inside the sandbox", () => {
    const p = resolveAndValidatePath("src/index.ts", { sandboxRoot: root });
    expect(p.startsWith(fs.realpathSync(root))).toBeTruthy();
  });

  it("allows the root itself and nested subdirs", () => {
    expect(isPathAllowed(".", { sandboxRoot: root })).toBeTruthy();
    expect(isPathAllowed("a/b/c/d.txt", { sandboxRoot: root })).toBeTruthy();
  });

  it("blocks classic ../ traversal", () => {
    expect(() => resolveAndValidatePath("../../etc/passwd", { sandboxRoot: root })).toThrow(
      "escapes the sandbox",
    );
  });

  it("blocks traversal hidden mid-path (a/../../b)", () => {
    expect(() => resolveAndValidatePath("a/../../b", { sandboxRoot: root })).toThrow();
  });

  it("blocks an absolute path outside the root", () => {
    expect(() => resolveAndValidatePath("/etc/passwd", { sandboxRoot: root })).toThrow();
  });

  it("blocks NUL-byte injection", () => {
    expect(() => resolveAndValidatePath("foo\0.txt", { sandboxRoot: root })).toThrow("NUL");
  });

  it("blocks a symlink that points outside the sandbox", () => {
    // Create a secret OUTSIDE the sandbox and a symlink INSIDE pointing to it.
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "issac-outside-"));
    fs.writeFileSync(path.join(outside, "secret.txt"), "top secret");
    const linkPath = path.join(root, "escape");
    fs.symlinkSync(outside, linkPath, process.platform === "win32" ? "junction" : "dir");

    // Reading through the symlink must be rejected.
    expect(() => resolveAndValidatePath("escape/secret.txt", { sandboxRoot: root })).toThrow(
      "symlink",
    );
    expect(isPathAllowed("escape/secret.txt", { sandboxRoot: root })).toBeFalsy();
  });

  it("throws a typed PathGuardError carrying context", () => {
    let caught: unknown;
    try {
      resolveAndValidatePath("../x", { sandboxRoot: root });
    } catch (e) {
      caught = e;
    }
    expect(caught instanceof PathGuardError).toBeTruthy();
  });
});
