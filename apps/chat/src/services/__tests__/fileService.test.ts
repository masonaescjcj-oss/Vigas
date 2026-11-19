import { describe, expect, it } from "vitest";
import { isUuid, relativeTime, toFileEntries } from "../formatting";

describe("toFileEntries", () => {
  it("derives name, depth and extension from the path", () => {
    const [entry] = toFileEntries({ "src/components/Button.tsx": "x" });
    expect(entry).toMatchObject({
      path: "src/components/Button.tsx",
      name: "Button.tsx",
      depth: 2,
      ext: "TSX",
    });
  });

  it("treats a root file as depth 0", () => {
    const [entry] = toFileEntries({ "index.html": "<p>x</p>" });
    expect(entry.depth).toBe(0);
  });

  it("sorts entries by path", () => {
    const paths = toFileEntries({ "b.txt": "", "a.txt": "", "src/c.txt": "" }).map((e) => e.path);
    expect(paths).toEqual(["a.txt", "b.txt", "src/c.txt"]);
  });

  it("reports size in bytes, KB and MB", () => {
    const [small] = toFileEntries({ "a.txt": "12345" });
    expect(small.sizeLabel).toBe("5 B");

    const [kb] = toFileEntries({ "b.txt": "x".repeat(2048) });
    expect(kb.sizeLabel).toBe("2.0 KB");

    const [mb] = toFileEntries({ "c.txt": "x".repeat(1024 * 1024 * 3) });
    expect(mb.sizeLabel).toBe("3.0 MB");
  });

  it("measures bytes, not characters, for multi-byte content", () => {
    // "س" is 2 bytes in UTF-8 — a naive length check would report 1.
    const [entry] = toFileEntries({ "fa.txt": "س" });
    expect(entry.sizeLabel).toBe("2 B");
  });

  it("handles a file with no extension", () => {
    const [entry] = toFileEntries({ Dockerfile: "FROM node" });
    expect(entry.ext).toBe("");
    expect(entry.name).toBe("Dockerfile");
  });

  it("returns an empty list for an empty project", () => {
    expect(toFileEntries({})).toEqual([]);
  });
});

describe("relativeTime", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("says 'just now' under a minute", () => {
    expect(relativeTime(ago(30_000))).toBe("just now");
  });

  it("reports minutes, hours and days", () => {
    expect(relativeTime(ago(5 * 60_000))).toBe("5 min ago");
    expect(relativeTime(ago(3 * 3_600_000))).toBe("3 hr ago");
    expect(relativeTime(ago(2 * 86_400_000))).toBe("2 days ago");
  });

  it("uses the singular for one day", () => {
    expect(relativeTime(ago(86_400_000))).toBe("1 day ago");
  });

  it("falls back to a date beyond a month", () => {
    const old = relativeTime(ago(60 * 86_400_000));
    expect(old).not.toContain("ago");
  });

  it("never reports a negative age for a future timestamp", () => {
    expect(relativeTime(new Date(Date.now() + 60_000).toISOString())).toBe("just now");
  });
});

/**
 * A non-uuid reaching agent-run is not a cosmetic problem: the run is rejected
 * and the chat shows a validation error instead of starting. This is the guard
 * added after a navigator's "global-default" placeholder did exactly that.
 */
describe("isUuid", () => {
  it("accepts a real uuid in either case", () => {
    expect(isUuid("acd3ef5a-1b53-4399-809d-2c1bc2669aa9")).toBe(true);
    expect(isUuid("ACD3EF5A-1B53-4399-809D-2C1BC2669AA9")).toBe(true);
  });

  it("rejects the placeholder that actually caused this", () => {
    expect(isUuid("global-default")).toBe(false);
  });

  it("rejects near-misses and non-strings", () => {
    expect(isUuid("acd3ef5a1b534399809d2c1bc2669aa9")).toBe(false); // no dashes
    expect(isUuid("acd3ef5a-1b53-4399-809d-2c1bc2669aa")).toBe(false); // one short
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});
